/**
 * @file native/windows-tray/Updater.cpp
 * @description 下载、校验、安装与回滚 Windows 更新。
 */
#include "Updater.h"
#include <winhttp.h>
#include <bcrypt.h>
#include <shellapi.h>
#include <algorithm>
#include <array>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <regex>
#include <set>
#include <sstream>
#include <stdexcept>
#include <thread>
#include "vendor/json.hpp"
extern "C" {
#include "vendor/miniz_tinfl.h"
}

namespace updater {
namespace fs = std::filesystem;
using Json = nlohmann::json;
namespace {
constexpr uint64_t maxArchive = 256ULL * 1024 * 1024;
constexpr uint64_t maxExpanded = 1024ULL * 1024 * 1024;
constexpr wchar_t manifestName[] = L"installation.json";
constexpr char api[] = "https://api.github.com/repos/HCLonely/AWA-Helper/releases/";
HANDLE installLock = INVALID_HANDLE_VALUE;
fs::path logRoot;
#ifdef AWA_UPDATER_TEST
std::function<void(const std::string&, const fs::path&)> requestOverride;
#endif

struct Handle {
  HANDLE value = nullptr;
  explicit Handle(HANDLE h = nullptr) : value(h) {}
  ~Handle() { if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value); }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
};
struct Internet {
  HINTERNET value;
  explicit Internet(HINTERNET h) : value(h) { if (!h) throw std::runtime_error("网络初始化失败"); }
  ~Internet() { WinHttpCloseHandle(value); }
};
std::wstring wide(const std::string& s) { return fs::u8path(s).wstring(); }
std::string utf8(const std::wstring& s) { return fs::path(s).u8string(); }
std::wstring quote(const fs::path& p) { return L"\"" + p.wstring() + L"\""; }
void require(bool ok, const std::string& error) { if (!ok) throw std::runtime_error(error); }
void log(const std::string& message) {
  if (logRoot.empty()) return;
  std::error_code ec;
  fs::create_directories(logRoot / L"logs", ec);
  std::ofstream out(logRoot / L"logs/Updater.log", std::ios::app);
  out << std::chrono::system_clock::to_time_t(std::chrono::system_clock::now()) << " " << message << "\n";
}
void plainFile(const fs::path& path) {
  for (auto current = path; !current.empty(); current = current.parent_path()) {
    const DWORD attributes = GetFileAttributesW(current.c_str());
    require(attributes == INVALID_FILE_ATTRIBUTES || !(attributes & FILE_ATTRIBUTE_REPARSE_POINT), "安装路径包含链接或重解析点");
    if (current == current.parent_path()) break;
  }
}
Json readJson(const fs::path& path) {
  plainFile(path);
  require(fs::file_size(path) <= 4 * 1024 * 1024, "JSON 文件过大");
  std::ifstream in(path);
  return Json::parse(in);
}
void writeJson(const fs::path& path, const Json& data) {
  plainFile(path);
  fs::create_directories(path.parent_path());
  const fs::path temporary = path.wstring() + L".tmp";
  plainFile(temporary);
  const auto contents = data.dump(2);
  Handle file(CreateFileW(temporary.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr));
  require(file.value != INVALID_HANDLE_VALUE, "无法写入安装记录");
  DWORD written = 0;
  require(WriteFile(file.value, contents.data(), static_cast<DWORD>(contents.size()), &written, nullptr) && written == contents.size() && FlushFileBuffers(file.value), "无法保存安装记录");
  CloseHandle(file.value); file.value = nullptr;
  require(MoveFileExW(temporary.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH), "无法提交安装记录");
}
std::string sha256(const fs::path& path) {
  BCRYPT_ALG_HANDLE algorithm = nullptr;
  BCRYPT_HASH_HANDLE hash = nullptr;
  require(BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) == 0, "无法初始化 SHA-256");
  if (BCryptCreateHash(algorithm, &hash, nullptr, 0, nullptr, 0, 0) != 0) {
    BCryptCloseAlgorithmProvider(algorithm, 0); throw std::runtime_error("无法初始化 SHA-256");
  }
  std::ifstream in(path, std::ios::binary);
  std::array<char, 65536> buffer{};
  bool ok = in.good();
  while (in.read(buffer.data(), buffer.size()) || in.gcount()) {
    ok = ok && BCryptHashData(hash, reinterpret_cast<PUCHAR>(buffer.data()), static_cast<ULONG>(in.gcount()), 0) == 0;
  }
  std::array<unsigned char, 32> digest{};
  ok = ok && !in.bad() && BCryptFinishHash(hash, digest.data(), static_cast<ULONG>(digest.size()), 0) == 0;
  BCryptDestroyHash(hash); BCryptCloseAlgorithmProvider(algorithm, 0);
  require(ok, "SHA-256 计算失败");
  std::ostringstream result;
  for (const auto byte : digest) result << std::hex << std::setw(2) << std::setfill('0') << static_cast<unsigned>(byte);
  return result.str();
}
bool programFile(const std::string& name) {
  // 用户配置和数据不得作为更新目标，
  // 即使打包错误的版本将它们列入清单也不例外。
  static const std::set<std::string> allowed = {
    "AWA-Manager.exe", "AWA-Helper.exe", "AWA-Manager.bat", "AWA-DailyQuest.bat",
    "update.bat", "README.html", "README_en.html", "config/config.example.yml",
    "healthcheck.js", "installation.json", "THIRD-PARTY-NOTICES.txt"
  };
  return allowed.count(name) != 0;
}
Json manifest(const fs::path& directory, bool verify) {
  auto data = readJson(directory / manifestName);
  require(data.at("schema") == 1 && data.at("files").is_array(), "不支持的安装清单");
  compareVersions(data.at("version").get<std::string>(), "0.0.0");
  require(data["files"].size() <= 1000, "安装清单文件过多");
  std::set<std::string> names;
  for (const auto& entry : data["files"]) {
    auto name = safePath(entry.at("path").get<std::string>());
    require(programFile(name) && name != "installation.json" && names.insert(name).second, "安装清单包含未知或重复程序文件");
    const auto path = directory / fs::u8path(name);
    plainFile(path);
    require(entry.at("required").is_boolean() && entry.at("size").is_number_unsigned(), "无效文件信息");
    require(std::regex_match(entry.at("sha256").get<std::string>(), std::regex("[a-f0-9]{64}")), "无效 SHA-256");
    if (verify) require(fs::is_regular_file(path) && fs::file_size(path) == entry["size"].get<uint64_t>() && sha256(path) == entry["sha256"], "程序文件校验失败: " + name);
  }
  require(names.count("AWA-Manager.exe") && names.count("AWA-Helper.exe"), "安装清单缺少程序");
  return data;
}
std::string token() {
  std::array<unsigned char, 16> bytes{};
  require(BCryptGenRandom(nullptr, bytes.data(), static_cast<ULONG>(bytes.size()), BCRYPT_USE_SYSTEM_PREFERRED_RNG) == 0, "随机数生成失败");
  std::ostringstream out;
  for (auto b : bytes) out << std::hex << std::setw(2) << std::setfill('0') << static_cast<unsigned>(b);
  return out.str();
}
void acquire(const fs::path& root) {
  require(installLock == INVALID_HANDLE_VALUE, "已有安装正在准备");
  plainFile(root / L".update/install.lock");
  fs::create_directories(root / L".update");
  // 关闭时删除可实现自动崩溃恢复；继承的句柄可在
  // 安装器交接期间持续持有同一个锁。
  const auto lockPath = root / L".update/install.lock";
  if (fs::exists(lockPath)) {
    // 兼容独立 Helper 更新器使用的进程锁格式。
    try {
      const auto owner = readJson(lockPath).at("pid").get<DWORD>();
      Handle process(OpenProcess(SYNCHRONIZE, FALSE, owner));
      const bool dead = process.value ? WaitForSingleObject(process.value, 0) == WAIT_OBJECT_0 : GetLastError() == ERROR_INVALID_PARAMETER;
      if (dead) { std::error_code ec; fs::remove(lockPath, ec); }
    } catch (...) { /* 不抢占无法读取或仍在使用的锁。 */ }
  }
  installLock = CreateFileW(lockPath.c_str(), GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ, nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_DELETE_ON_CLOSE, nullptr);
  require(installLock != INVALID_HANDLE_VALUE, "另一个更新正在进行，或安装目录不可写");
  const auto owner = Json{{"pid", GetCurrentProcessId()}, {"startedAt", "native"}}.dump();
  DWORD written = 0;
  if (!WriteFile(installLock, owner.data(), static_cast<DWORD>(owner.size()), &written, nullptr) || written != owner.size() || !FlushFileBuffers(installLock)) {
    releaseLock(); throw std::runtime_error("无法写入更新锁");
  }
}
struct HttpError : std::runtime_error {
  bool missing;
  HttpError(DWORD status) : std::runtime_error("HTTP " + std::to_string(status)), missing(status == 404 || status == 410) {}
};
void request(const std::string& url, const fs::path& destination, uint64_t limit, const Progress& progress) {
#ifdef AWA_UPDATER_TEST
  if (requestOverride) { requestOverride(url, destination); return; }
#endif
  auto address = wide(url);
  URL_COMPONENTS parts{}; parts.dwStructSize = sizeof(parts);
  parts.dwHostNameLength = parts.dwUrlPathLength = parts.dwExtraInfoLength = static_cast<DWORD>(-1);
  require(WinHttpCrackUrl(address.c_str(), 0, 0, &parts) && parts.nScheme == INTERNET_SCHEME_HTTPS, "仅允许 HTTPS 下载");
  const std::wstring host(parts.lpszHostName, parts.dwHostNameLength);
  const std::wstring path = std::wstring(parts.lpszUrlPath, parts.dwUrlPathLength) + std::wstring(parts.lpszExtraInfo, parts.dwExtraInfoLength);
  Internet session(WinHttpOpen(L"AWA-Manager", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0));
  WinHttpSetTimeouts(session.value, 10000, 10000, 15000, 30000);
  Internet connection(WinHttpConnect(session.value, host.c_str(), parts.nPort, 0));
  Internet query(WinHttpOpenRequest(connection.value, L"GET", path.c_str(), nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, WINHTTP_FLAG_SECURE));
  DWORD redirectPolicy = WINHTTP_OPTION_REDIRECT_POLICY_DISALLOW_HTTPS_TO_HTTP;
  WinHttpSetOption(query.value, WINHTTP_OPTION_REDIRECT_POLICY, &redirectPolicy, sizeof(redirectPolicy));
  require(WinHttpSendRequest(query.value, L"Accept: application/octet-stream, application/vnd.github+json\r\n", static_cast<DWORD>(-1), nullptr, 0, 0, 0) && WinHttpReceiveResponse(query.value, nullptr), "连接失败或超时");
  DWORD status = 0, size = sizeof(status);
  require(WinHttpQueryHeaders(query.value, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, nullptr, &status, &size, nullptr), "无效 HTTP 响应");
  if (status != 200) throw HttpError(status);
  std::ofstream out(destination, std::ios::binary | std::ios::trunc);
  require(out.good(), "无法创建下载文件");
  std::array<char, 65536> buffer{};
  uint64_t total = 0;
  const auto started = GetTickCount64();
  auto reported = started;
  while (true) {
    DWORD bytes = 0;
    require(WinHttpReadData(query.value, buffer.data(), static_cast<DWORD>(buffer.size()), &bytes), "下载中断或超时");
    if (!bytes) break;
    total += bytes;
    require(total <= limit, "下载内容超过大小限制");
    require(GetTickCount64() - started < 10 * 60 * 1000, "下载超过十分钟");
    out.write(buffer.data(), bytes);
    require(out.good(), "写入下载文件失败");
    if (progress && GetTickCount64() - reported > 500) {
      progress(L"正在下载 " + std::to_wstring(total / 1024) + L" KiB"); reported = GetTickCount64();
    }
  }
  out.close(); require(out.good(), "保存下载文件失败");
}
template<class Validate> void download(const std::string& url, const fs::path& destination, uint64_t limit, const Progress& progress, Validate validate) {
  std::string errors;
  for (const auto& source : sources(url)) {
    try {
      log("请求 " + source);
      if (progress) progress(L"正在连接 " + wide(source.substr(0, source.find('/', 8))));
      request(source, destination, limit, progress);
      validate(destination);
      return;
    } catch (const HttpError& error) {
      std::error_code ec; fs::remove(destination, ec);
      log(source + ": " + error.what());
      if (error.missing) throw std::runtime_error("发布文件或版本不存在 (" + std::string(error.what()) + ")");
      errors = error.what();
    } catch (const std::exception& error) {
      std::error_code ec; fs::remove(destination, ec);
      log(source + ": " + error.what()); errors = error.what();
    }
  }
  throw std::runtime_error("直连及三个加速地址均失败：" + errors);
}
Json release(const fs::path& stage, const std::string& tag, const Progress& progress) {
  Json result;
  download(std::string(api) + (tag.empty() ? "latest" : "tags/" + tag), stage / L"release.json", 4 * 1024 * 1024, progress, [&](const fs::path& path) {
    result = readJson(path);
    compareVersions(result.at("tag_name").get<std::string>(), "0.0.0");
    if (!tag.empty()) require(compareVersions(result.at("tag_name").get<std::string>(), tag) == 0, "返回的修复版本与请求不一致");
    require(result.at("assets").is_array() && !result.value("draft", false), "无效的发布信息");
    if (tag.empty()) require(!result.value("prerelease", false), "最新发布不是正式版");
  });
  return result;
}
HANDLE spawn(const fs::path& executable, const std::wstring& arguments, const fs::path& directory, bool inherit = false) {
  std::wstring command = quote(executable) + L" " + arguments;
  STARTUPINFOW startup{}; startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESHOWWINDOW; startup.wShowWindow = SW_HIDE;
  PROCESS_INFORMATION process{};
  require(CreateProcessW(executable.c_str(), command.data(), nullptr, nullptr, inherit, CREATE_NO_WINDOW, nullptr, directory.c_str(), &startup, &process), "无法启动安装或管理进程");
  CloseHandle(process.hThread);
  return process.hProcess;
}
fs::path stagePath(const fs::path& root, const Json& journal) {
  const auto name = journal.at("stage").get<std::string>();
  require(std::regex_match(name, std::regex("staging-[a-f0-9]{32}")), "无效的安装暂存目录");
  const auto result = root / L".update" / fs::u8path(name);
  plainFile(result); return result;
}
void copyProgramFile(const fs::path& from, const fs::path& to) {
  plainFile(from); plainFile(to);
  fs::create_directories(to.parent_path());
  const auto temporary = to.wstring() + L".awa-new";
  plainFile(temporary);
  fs::copy_file(from, temporary, fs::copy_options::overwrite_existing);
  Handle file(CreateFileW(temporary.c_str(), GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr));
  require(file.value != INVALID_HANDLE_VALUE && FlushFileBuffers(file.value), "无法保存程序文件");
  CloseHandle(file.value); file.value = nullptr;
  require(MoveFileExW(temporary.c_str(), to.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH), "无法替换程序文件，文件可能被占用");
}
void rollback(const fs::path& root, Json& journal) {
  const auto stage = stagePath(root, journal);
  for (const auto& file : journal.at("changes")) {
    const auto name = safePath(file.at("path").get<std::string>());
    require(programFile(name), "恢复记录包含非程序文件");
    const auto target = root / fs::u8path(name);
    plainFile(target);
    if (file.at("existed").get<bool>()) copyProgramFile(stage / L"backup" / fs::u8path(name), target);
    else fs::remove(target);
    const fs::path temporary = target.wstring() + L".awa-new";
    plainFile(temporary); fs::remove(temporary);
  }
  journal["state"] = "rolled-back";
  writeJson(root / L".update/current.json", journal);
  log("已恢复旧版程序文件");
}
void install(const fs::path& root, Json& journal) {
  const auto stage = stagePath(root, journal);
  const auto source = stage / L"payload";
  const auto data = manifest(source, true);
  require(data.at("version") == journal.at("version"), "安装版本不匹配");
  std::set<std::string> paths;
  for (const auto& file : data["files"]) paths.insert(file["path"].get<std::string>());
  auto replacements = paths;
  replacements.insert("installation.json");
  paths.insert("installation.json");
  if (fs::exists(root / manifestName)) {
    try {
      const auto old = manifest(root, false);
      for (const auto& file : old["files"]) paths.insert(file["path"].get<std::string>());
    } catch (const std::exception&) {
      log("旧安装清单损坏，只替换新清单中的文件，保留其他文件");
    }
  }
  Json changes = Json::array();
  for (const auto& name : paths) {
    const auto target = root / fs::u8path(name);
    plainFile(target);
    const bool existed = fs::exists(target);
    if (existed) copyProgramFile(target, stage / L"backup" / fs::u8path(name));
    changes.push_back({{"path", name}, {"existed", existed}});
  }
  journal["changes"] = changes; journal["state"] = "installing";
  writeJson(root / L".update/current.json", journal);
  // 修改第一个目标前，先持久化完整的回滚清单。
  for (const auto& name : paths) {
    if (replacements.count(name)) copyProgramFile(source / fs::u8path(name), root / fs::u8path(name));
    else fs::remove(root / fs::u8path(name));
  }
  journal["state"] = "health";
  writeJson(root / L".update/current.json", journal);
}
HANDLE processHandle(DWORD pid) {
  if (!pid) return nullptr;
  const auto process = OpenProcess(SYNCHRONIZE, FALSE, pid);
  if (!process) require(GetLastError() == ERROR_INVALID_PARAMETER, "无法等待退出进程");
  return process;
}
void awaitHandle(HANDLE process) {
  if (process) require(WaitForSingleObject(process, 120000) == WAIT_OBJECT_0, "程序退出超时，已中止安装");
}
}

int compareVersions(std::string left, std::string right) {
  const std::regex pattern("^[vV]?(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$");
  std::smatch a, b;
  require(std::regex_match(left, a, pattern) && std::regex_match(right, b, pattern), "无效的语义版本号");
  for (const auto* match : {&a, &b}) {
    std::istringstream parts((*match)[4].str()); std::string part;
    while (std::getline(parts, part, '.')) require(!(part.size() > 1 && part[0] == '0' && part.find_first_not_of("0123456789") == std::string::npos), "预发布数字不能以零开头");
  }
  for (int i = 1; i <= 3; ++i) {
    const auto x = std::stoull(a[i].str()), y = std::stoull(b[i].str());
    if (x != y) return x < y ? -1 : 1;
  }
  if (a[4].str().empty() || b[4].str().empty()) return a[4].str() == b[4].str() ? 0 : a[4].str().empty() ? 1 : -1;
  std::istringstream ax(a[4].str()), bx(b[4].str());
  std::string x, y;
  while (true) {
    const bool hasX = static_cast<bool>(std::getline(ax, x, '.')), hasY = static_cast<bool>(std::getline(bx, y, '.'));
    if (!hasX || !hasY) return hasX == hasY ? 0 : hasX ? 1 : -1;
    require(!x.empty() && !y.empty(), "无效的预发布版本号");
    if (x == y) continue;
    const bool nx = x.find_first_not_of("0123456789") == std::string::npos, ny = y.find_first_not_of("0123456789") == std::string::npos;
    if (nx && ny) return std::stoull(x) < std::stoull(y) ? -1 : 1;
    if (nx != ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
}
std::string safePath(std::string value) {
  std::replace(value.begin(), value.end(), '\\', '/');
  require(!value.empty() && value.front() != '/' && value.find(':') == std::string::npos && value.find('\0') == std::string::npos, "不安全的文件路径");
  std::istringstream stream(value); std::string part;
  const std::regex reserved("^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\\..*)?$", std::regex::icase);
  while (std::getline(stream, part, '/')) {
    require(!part.empty() && part != "." && part != ".." && part.back() != '.' && part.back() != ' ' && !std::regex_match(part, reserved), "不安全的文件路径");
    require(part.find_first_of("<>\"|?*") == std::string::npos && std::none_of(part.begin(), part.end(), [](unsigned char c) { return c < 32; }), "不安全的文件路径");
  }
  return value;
}
std::vector<std::string> sources(const std::string& original) {
  require(original.rfind("https://api.github.com/", 0) == 0 || original.rfind("https://github.com/HCLonely/AWA-Helper/releases/download/", 0) == 0, "下载地址不属于项目 GitHub 发布");
  return {original, "https://gh-proxy.org/" + original, "https://cdn.gh-proxy.org/" + original, "https://axisnow.gh-proxy.org/" + original};
}

namespace {
struct InflateOutput { std::ofstream stream; uint64_t size = 0; uint32_t crc = 0xffffffff; };
int inflateWrite(const void* data, int length, void* context) {
  auto& output = *static_cast<InflateOutput*>(context);
  output.size += static_cast<unsigned>(length);
  if (output.size > maxExpanded) return 0;
  const auto* bytes = static_cast<const unsigned char*>(data);
  for (int i = 0; i < length; ++i) {
    output.crc ^= bytes[i];
    for (int bit = 0; bit < 8; ++bit) output.crc = (output.crc >> 1) ^ (0xedb88320U & (0U - (output.crc & 1)));
  }
  output.stream.write(static_cast<const char*>(data), length);
  return output.stream.good() ? 1 : 0;
}
uint64_t octal(const char* data, size_t size) {
  uint64_t value = 0;
  for (size_t i = 0; i < size; ++i) {
    if (data[i] == '\0' || data[i] == ' ') continue;
    require(data[i] >= '0' && data[i] <= '7' && value <= maxExpanded, "不支持的 tar 数值");
    value = value * 8 + static_cast<unsigned>(data[i] - '0');
  }
  return value;
}
}
void extract(const fs::path& archive, const fs::path& destination) {
  require(fs::file_size(archive) <= maxArchive, "压缩包过大");
  std::ifstream input(archive, std::ios::binary);
  std::vector<unsigned char> data((std::istreambuf_iterator<char>(input)), {});
  require(data.size() >= 18 && data[0] == 31 && data[1] == 139 && data[2] == 8 && !(data[3] & 0xe0), "无效 gzip 压缩包");
  size_t start = 10;
  if (data[3] & 4) { require(start + 2 < data.size() - 8, "损坏的 gzip 头"); const auto length = data[start] | (data[start + 1] << 8); start += 2 + length; }
  for (const int flag : {8, 16}) if (data[3] & flag) { while (start < data.size() - 8 && data[start]) ++start; ++start; }
  if (data[3] & 2) start += 2;
  require(start < data.size() - 8, "损坏的 gzip 头");
  plainFile(destination); fs::create_directories(destination);
  const auto tarPath = destination.parent_path() / L"expanded.tar";
  InflateOutput output{std::ofstream(tarPath, std::ios::binary | std::ios::trunc)};
  size_t compressed = data.size() - 8 - start;
  require(tinfl_decompress_mem_to_callback(data.data() + start, &compressed, inflateWrite, &output, 0) == 1, "gzip 解压失败或超过大小限制");
  output.stream.close(); require(output.stream.good(), "写入解压文件失败");
  auto little = [&](size_t at) { return uint32_t(data[at]) | (uint32_t(data[at + 1]) << 8) | (uint32_t(data[at + 2]) << 16) | (uint32_t(data[at + 3]) << 24); };
  require(compressed == data.size() - 8 - start && (output.crc ^ 0xffffffff) == little(data.size() - 8) && output.size == little(data.size() - 4), "gzip 内容校验失败");
  data.clear(); data.shrink_to_fit();
  std::ifstream tar(tarPath, std::ios::binary);
  std::array<char, 512> header{};
  std::set<std::string> names;
  unsigned entries = 0;
  bool ended = false;
  while (tar.read(header.data(), header.size())) {
    if (std::all_of(header.begin(), header.end(), [](char c) { return c == 0; })) { ended = true; break; }
    require(++entries <= 10000, "压缩包文件过多");
    uint64_t checksum = 0;
    for (size_t i = 0; i < header.size(); ++i) checksum += i >= 148 && i < 156 ? 32 : static_cast<unsigned char>(header[i]);
    require(checksum == octal(header.data() + 148, 8), "tar 校验失败");
    auto name = std::string(header.data(), strnlen_s(header.data(), 100));
    const auto prefix = std::string(header.data() + 345, strnlen_s(header.data() + 345, 155));
    if (!prefix.empty()) name = prefix + "/" + name;
    if (name.rfind("./", 0) == 0) name.erase(0, 2);
    while (!name.empty() && name.back() == '/') name.pop_back();
    const auto size = octal(header.data() + 124, 12);
    require(size <= maxExpanded, "tar 文件过大");
    const char kind = header[156];
    require(kind == '0' || kind == '\0' || kind == '5', "压缩包包含链接、扩展头或特殊文件；请使用 ustar 格式发布");
    require(name == "output" || name.rfind("output/", 0) == 0, "压缩包根目录必须为 output");
    safePath(name);
    std::string key = name; std::transform(key.begin(), key.end(), key.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    require(names.insert(key).second, "压缩包包含重复路径");
    if (name == "output") { require(kind == '5' && size == 0, "无效 output 根目录"); continue; }
    const auto relative = name.substr(7);
    const auto target = destination / fs::u8path(relative);
    plainFile(target);
    if (kind == '5') { require(size == 0, "无效目录大小"); fs::create_directories(target); }
    else {
      // 仅提取已知的发布文件，忽略旧归档中的用户数据。
      if (programFile(relative)) {
        fs::create_directories(target.parent_path());
        std::ofstream out(target, std::ios::binary);
        std::array<char, 65536> buffer{};
        uint64_t remaining = size;
        while (remaining) {
          const auto chunk = static_cast<std::streamsize>(std::min<uint64_t>(remaining, buffer.size()));
          require(static_cast<bool>(tar.read(buffer.data(), chunk)), "tar 文件被截断");
          out.write(buffer.data(), chunk); require(out.good(), "解压写入失败"); remaining -= chunk;
        }
      } else tar.seekg(static_cast<std::streamoff>(size), std::ios::cur);
      tar.seekg(static_cast<std::streamoff>((512 - size % 512) % 512), std::ios::cur);
      require(tar.good(), "tar 文件被截断");
    }
  }
  require(ended, "tar 缺少结束标记");
  tar.close(); fs::remove(tarPath);
}

std::wstring version(const fs::path& root) {
  try { return wide(manifest(root, false).at("version").get<std::string>()); } catch (...) {}
  // 旧版发布没有安装清单，.version 由 Helper 写入。
  try {
    std::ifstream in(root / L".version"); std::string value; std::getline(in, value);
    if (!value.empty() && value.back() == '\r') value.pop_back();
    compareVersions(value, "0.0.0"); return wide(value);
  } catch (...) { return L""; }
}
bool complete(const fs::path& root) {
  try {
    if (!fs::is_regular_file(root / L"AWA-Helper.exe")) return false;
    // 兼容已有安装首次运行时的旧版数据。
    if (!fs::exists(root / manifestName)) return true;
    const auto data = manifest(root, false);
    for (const auto& file : data["files"]) if (file["required"].get<bool>()) {
      const auto path = root / fs::u8path(file["path"].get<std::string>());
      if (!fs::is_regular_file(path) || fs::file_size(path) != file["size"].get<uint64_t>()) return false;
    }
    return true;
  } catch (...) { return false; }
}
Prepared prepare(const fs::path& root, bool repair, const Progress& progress) {
  logRoot = root; acquire(root);
  fs::path stage;
  try {
    stage = root / L".update" / wide("staging-" + token());
    fs::create_directories(stage);
    const auto current = utf8(version(root));
    const auto targetTag = repair && !current.empty() ? (current[0] == 'v' || current[0] == 'V' ? "v" + current.substr(1) : "v" + current) : "";
    progress(repair ? L"正在准备安装或修复" : L"正在检查更新");
    const auto info = release(stage, targetTag, progress);
    auto target = info.at("tag_name").get<std::string>();
    if (target[0] == 'v' || target[0] == 'V') target.erase(0, 1);
    if (!repair && !current.empty() && compareVersions(current, target) >= 0 && (compareVersions(current, target) > 0 || complete(root))) {
      fs::remove_all(stage); releaseLock();
      return {{}, compareVersions(current, target) == 0 ? L"当前已是最新版 v" + wide(target) : L"暂无可用更新，当前版本高于最新正式版"};
    }
    Json asset;
    for (const auto& entry : info["assets"]) if (entry.at("name") == "AWA-Helper-Win.tar.gz") asset = entry;
    require(!asset.is_null(), "此版本缺少 AWA-Helper-Win.tar.gz");
    const auto size = asset.at("size").get<uint64_t>();
    require(size > 0 && size <= maxArchive, "无效的安装包大小");
    std::string digest = asset.contains("digest") && asset["digest"].is_string() ? asset["digest"].get<std::string>() : "";
    if (digest.rfind("sha256:", 0) == 0) digest.erase(0, 7); else digest.clear();
    if (digest.empty()) {
      Json check;
      for (const auto& entry : info["assets"]) if (entry.at("name") == "AWA-Helper-Win.tar.gz.sha256") check = entry;
      require(!check.is_null(), "发布缺少 Windows 包 SHA-256 校验信息");
      download(check.at("browser_download_url"), stage / L"checksum", 1024, progress, [&](const fs::path& file) {
        std::ifstream in(file); in >> digest;
        require(std::regex_match(digest, std::regex("[a-fA-F0-9]{64}")), "无效的校验文件");
      });
    }
    std::transform(digest.begin(), digest.end(), digest.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    require(std::regex_match(digest, std::regex("[a-f0-9]{64}")), "无效 SHA-256");
    require(fs::space(root).available > maxExpanded + size * 2, "磁盘空间不足，需要至少约 1 GiB 可用空间");
    const auto archive = stage / L"package.tar.gz";
    download(asset.at("browser_download_url"), archive, size, progress, [&](const fs::path& file) {
      progress(L"正在校验安装包");
      require(fs::file_size(file) == size && sha256(file) == digest, "安装包大小或 SHA-256 校验失败");
    });
    progress(L"正在解压并检查程序文件");
    extract(archive, stage / L"payload");
    require(fs::exists(stage / L"payload" / manifestName), "此版本尚未提供安装清单，请通过检查更新安装支持自动安装的新版本");
    const auto data = manifest(stage / L"payload", true);
    require(compareVersions(data.at("version"), target) == 0, "安装包版本与 Release 不一致");
    return {stage, L"准备安装 v" + wide(target)};
  } catch (const std::exception& error) {
    log(error.what());
    if (!stage.empty()) { std::error_code ec; fs::remove_all(stage, ec); }
    releaseLock(); throw;
  }
}
void releaseLock() {
  if (installLock != INVALID_HANDLE_VALUE) { CloseHandle(installLock); installLock = INVALID_HANDLE_VALUE; }
}
void apply(const fs::path& root, const Prepared& prepared, DWORD helperPid) {
  const auto data = manifest(prepared.stage / L"payload", true);
  const auto stageName = prepared.stage.filename().u8string();
  const auto id = token();
  Json journal = {{"stage", stageName}, {"state", "prepared"}, {"version", data["version"]}, {"managerPid", GetCurrentProcessId()}, {"helperPid", helperPid}, {"event", "Local\\AWAUpdate-" + id}, {"changes", Json::array()}};
  writeJson(root / L".update/current.json", journal);
  wchar_t self[32768]{}; GetModuleFileNameW(nullptr, self, 32768);
  copyProgramFile(self, prepared.stage / L"installer.exe");
  Handle ready(CreateEventW(nullptr, TRUE, FALSE, wide("Local\\AWAApply-" + id).c_str()));
  require(ready.value != nullptr, "无法创建安装握手事件");
  require(SetHandleInformation(installLock, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT), "无法传递更新锁");
  try {
    Handle process(spawn(prepared.stage / L"installer.exe", L"--apply-update " + quote(root) + L" " + std::to_wstring(reinterpret_cast<uintptr_t>(installLock)) + L" " + wide(id), root, true));
    SetHandleInformation(installLock, HANDLE_FLAG_INHERIT, 0);
    HANDLE waits[]{ready.value, process.value};
    require(WaitForMultipleObjects(2, waits, FALSE, 15000) == WAIT_OBJECT_0, "安装进程未就绪");
    releaseLock();
  } catch (...) { SetHandleInformation(installLock, HANDLE_FLAG_INHERIT, 0); throw; }
}
void healthReady(const std::wstring& eventName) {
  if (eventName.empty()) return;
  Handle event(OpenEventW(EVENT_MODIFY_STATE, FALSE, eventName.c_str()));
  if (event.value) SetEvent(event.value);
}
void validateHealth(const fs::path& root, const std::wstring& eventName) {
  const auto journal = readJson(root / L".update/current.json");
  require(journal.at("state") == "health" && wide(journal.at("event").get<std::string>()) == eventName, "无效的启动检查请求");
  Handle event(OpenEventW(EVENT_MODIFY_STATE, FALSE, eventName.c_str()));
  require(event.value != nullptr, "更新安装进程已经退出，请重新启动 Manager 进行恢复");
}
void markTray(const fs::path& root) {
  writeJson(root / L".update/tray.json", {{"pid", GetCurrentProcessId()}});
}
void unmarkTray(const fs::path& root) {
  try {
    const auto path = root / L".update/tray.json";
    if (readJson(path).at("pid").get<DWORD>() == GetCurrentProcessId()) fs::remove(path);
  } catch (...) { /* 崩溃或过期的标记由独立更新器处理。 */ }
}
bool recover(const fs::path& root) {
  logRoot = root;
  if (!fs::exists(root / L".update")) return false;
  acquire(root);
  if (!fs::exists(root / L".update/current.json")) { releaseLock(); return false; }
  const auto journal = readJson(root / L".update/current.json");
  const auto state = journal.value("state", "");
  if (state != "installing" && state != "health") { releaseLock(); return false; }
  const auto stage = stagePath(root, journal);
  wchar_t self[32768]{}; GetModuleFileNameW(nullptr, self, 32768);
  copyProgramFile(self, stage / L"recovery.exe");
  SetHandleInformation(installLock, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
  Handle process(spawn(stage / L"recovery.exe", L"--recover-update " + quote(root) + L" " + std::to_wstring(reinterpret_cast<uintptr_t>(installLock)) + L" " + std::to_wstring(GetCurrentProcessId()), root, true));
  releaseLock(); return true;
}
int internalMode(const std::vector<std::wstring>& args) {
  if (args.size() < 2 || (args[1] != L"--apply-update" && args[1] != L"--recover-update")) return -1;
  fs::path root;
  Json journal;
  bool canRollback = true;
  try {
    require(args.size() == 5, "无效安装参数");
    root = fs::absolute(args[2]); logRoot = root;
    installLock = reinterpret_cast<HANDLE>(static_cast<uintptr_t>(std::stoull(args[3])));
    DWORD flags = 0; require(GetHandleInformation(installLock, &flags), "安装锁未继承");
    SetHandleInformation(installLock, HANDLE_FLAG_INHERIT, 0);
    journal = readJson(root / L".update/current.json");
    stagePath(root, journal);
    if (args[1] == L"--recover-update") {
      Handle parent(processHandle(static_cast<DWORD>(std::stoul(args[4]))));
      awaitHandle(parent.value);
      rollback(root, journal); releaseLock();
      if (fs::exists(root / L"AWA-Helper.exe")) { Handle process(spawn(root / L"AWA-Manager.exe", L"--update-result recovered", root)); }
      return 0;
    }
    require(std::regex_match(utf8(args[4]), std::regex("[a-f0-9]{32}")), "无效握手标识");
    Handle ready(OpenEventW(EVENT_MODIFY_STATE, FALSE, (L"Local\\AWAApply-" + args[4]).c_str()));
    require(ready.value != nullptr, "父进程已退出");
    Handle healthy(CreateEventW(nullptr, TRUE, FALSE, wide(journal.at("event").get<std::string>()).c_str()));
    require(healthy.value != nullptr, "无法创建启动检查事件");
    Handle helper(processHandle(journal.at("helperPid").get<DWORD>()));
    Handle manager(processHandle(journal.at("managerPid").get<DWORD>()));
    SetEvent(ready.value);
    awaitHandle(helper.value);
    awaitHandle(manager.value);
    install(root, journal);
    // 新的便携式安装需要先生成默认配置，才能启动 Helper。
    if (!fs::exists(root / L"config.yml") && !fs::exists(root / L"config/config.yml")) {
      const auto example = root / L"config/config.example.yml";
      if (fs::exists(example)) copyProgramFile(example, root / L"config/config.yml");
    }
    Handle process(spawn(root / L"AWA-Manager.exe", L"--update-health " + wide(journal.at("event").get<std::string>()), root));
    canRollback = false;
    HANDLE waits[]{healthy.value, process.value};
    if (WaitForMultipleObjects(2, waits, FALSE, 120000) != WAIT_OBJECT_0) {
      // 请求刚启动的托盘正常退出，不覆盖正在运行的可执行文件。
      const auto window = FindWindowExW(HWND_MESSAGE, nullptr, L"AWAHelperManagerTrayWindow", root.c_str());
      if (window) PostMessageW(window, WM_CLOSE, 0, 0);
      require(WaitForSingleObject(process.value, 120000) == WAIT_OBJECT_0, "新版启动检查失败且未退出；保留恢复记录，下次启动重试");
      canRollback = true;
      throw std::runtime_error("新版未能完成启动，正在恢复旧版");
    }
    auto committed = journal;
    committed["state"] = "completed";
    writeJson(root / L".update/current.json", committed);
    journal = committed;
    // 辅助诊断不得撤销已提交的安装。
    try {
      writeJson(root / L".update/last-result.json", {{"status", "success"}, {"version", journal["version"]}});
      writeJson(stagePath(root, journal) / L"completed.json", {{"status", "success"}});
    } catch (const std::exception& error) { log(error.what()); }
    log("更新成功 " + journal["version"].get<std::string>());
    releaseLock();
    const auto window = FindWindowExW(HWND_MESSAGE, nullptr, L"AWAHelperManagerTrayWindow", root.c_str());
    if (window) PostMessageW(window, WM_APP + 24, 0, 0);
    return 0;
  } catch (const std::exception& error) {
    log(error.what());
    try {
      if (!root.empty() && !journal.is_null()) {
        const auto state = journal.value("state", "");
        if ((state == "installing" || state == "health") && !canRollback) throw std::runtime_error("新版仍在运行，保留恢复记录，停止程序后重新启动以恢复");
        if (state == "installing" || state == "health") rollback(root, journal);
        else { journal["state"] = "failed"; writeJson(root / L".update/current.json", journal); }
        writeJson(root / L".update/last-result.json", {{"status", "failed"}, {"error", error.what()}});
        releaseLock();
        if (state == "installing" || state == "health") {
          if (fs::exists(root / L"AWA-Helper.exe")) { Handle process(spawn(root / L"AWA-Manager.exe", L"--update-result failed", root)); }
        }
      }
    } catch (const std::exception& recoveryError) { log(std::string("恢复未完成: ") + recoveryError.what()); }
    releaseLock();
#ifndef AWA_UPDATER_TEST
    MessageBoxW(nullptr, wide(error.what()).c_str(), L"AWA-Manager 更新失败", MB_OK | MB_ICONERROR);
#endif
    return 1;
  }
}
}
