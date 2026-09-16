// Compiles the same implementation with only network I/O and error dialogs
// substituted. Installation/recovery subprocesses and file operations are real.
#define AWA_UPDATER_TEST
#include "Updater.cpp"
#include <iostream>

namespace {
using namespace updater;
fs::path self;
void check(bool value, const char* message) { if (!value) throw std::runtime_error(message); }
template<class Action> void rejects(Action action) {
  bool failed = false;
  try { action(); } catch (const std::exception&) { failed = true; }
  check(failed, "expected rejection");
}
void write(const fs::path& path, const std::string& contents) {
  fs::create_directories(path.parent_path()); std::ofstream(path, std::ios::binary) << contents;
}
std::string read(const fs::path& path) {
  std::ifstream in(path, std::ios::binary); return {std::istreambuf_iterator<char>(in), {}};
}
void package(const fs::path& directory, const std::string& ver, bool runnable = true) {
  fs::create_directories(directory);
  if (runnable) fs::copy_file(self, directory / L"AWA-Manager.exe", fs::copy_options::overwrite_existing);
  else write(directory / L"AWA-Manager.exe", "invalid executable");
  write(directory / L"AWA-Helper.exe", "helper " + ver);
  write(directory / L"config/config.example.yml", "language: zh\n");
  write(directory / L"README.html", "readme " + ver);
  Json data = {{"schema", 1}, {"version", ver}, {"files", Json::array()}};
  for (const auto* name : {"AWA-Manager.exe", "AWA-Helper.exe", "config/config.example.yml", "README.html"}) {
    const auto file = directory / fs::u8path(name);
    data["files"].push_back({{"path", name}, {"size", fs::file_size(file)}, {"sha256", sha256(file)}, {"required", true}});
  }
  writeJson(directory / manifestName, data);
}
Json transaction(const fs::path& stage) {
  return {{"stage", stage.filename().u8string()}, {"state", "prepared"}, {"version", "9.1.0"}, {"changes", Json::array()}};
}
void waitState(const fs::path& root, const std::string& desired) {
  const auto start = GetTickCount64();
  while (GetTickCount64() - start < 30000) {
    try { if (readJson(root / L".update/current.json").value("state", "") == desired) {
      // The lock also covers process hand-off and final status writes.
      if (!fs::exists(root / L".update/install.lock")) return;
    } } catch (...) {}
    Sleep(50);
  }
  throw std::runtime_error("installer did not reach " + desired);
}
void pureTests(const fs::path& base) {
  check(compareVersions("v3.4.9", "3.4.10") < 0, "numeric version ordering");
  check(compareVersions("3.4.8-beta.2", "3.4.8-beta.10") < 0, "prerelease numeric ordering");
  check(compareVersions("3.4.8", "3.4.8-beta") > 0, "stable version ordering");
  check(compareVersions("3.4.8+build", "3.4.8") == 0, "build metadata ordering");
  rejects([] { compareVersions("broken", "1.0.0"); });
  rejects([] { compareVersions("1.0.0-alpha..1", "1.0.0"); });
  rejects([] { compareVersions("1.0.0-01", "1.0.0-1"); });
  for (const auto* path : {"../x", "C:/x", "/x", "a/../b", "a:x", "a./b", "CON", "a/NUL.txt", "a//b", "a/./b", "a?b"}) rejects([&] { safePath(path); });
  check(safePath("config/config.example.yml") == "config/config.example.yml", "normal path");
  const auto urls = sources(std::string(api) + "latest");
  check(urls.size() == 4 && urls[1] == "https://gh-proxy.org/" + urls[0] && urls[2] == "https://cdn.gh-proxy.org/" + urls[0] && urls[3] == "https://axisnow.gh-proxy.org/" + urls[0], "proxy order");
  rejects([] { sources("https://gh-proxy.org/https://api.github.com/test"); });
  std::vector<std::string> attempts;
  requestOverride = [&](const std::string& url, const fs::path& to) {
    attempts.push_back(url); write(to, attempts.size() < 3 ? "corrupt" : "valid");
  };
  download(urls[0], base / L"download", 1024, {}, [](const fs::path& file) { require(read(file) == "valid", "bad digest"); });
  check(attempts == std::vector<std::string>(urls.begin(), urls.begin() + 3), "integrity failures switch proxies in order");
  attempts.clear();
  requestOverride = [&](const std::string& url, const fs::path&) { attempts.push_back(url); throw std::runtime_error("offline"); };
  rejects([&] { download(urls[0], base / L"download", 1024, {}, [](const fs::path&) {}); });
  check(attempts == urls && !fs::exists(base / L"download"), "all sources tried; partial removed");
  attempts.clear();
  requestOverride = [&](const std::string& url, const fs::path&) { attempts.push_back(url); throw HttpError(404); };
  rejects([&] { download(urls[0], base / L"download", 1024, {}, [](const fs::path&) {}); });
  check(attempts.size() == 1, "missing release is not a network failure");
  requestOverride = {};
}
void transactionTests(const fs::path& base) {
  const auto root = base / L"transaction";
  package(root, "9.0.0");
  write(root / L"config/config.yml", "cookie: do-not-overwrite");
  write(root / L"data/user.json", "user-data");
  auto stage = root / L".update" / wide("staging-" + token());
  package(stage / L"payload", "9.1.0");
  auto journal = transaction(stage);
  install(root, journal);
  check(version(root) == L"9.1.0", "installed new version");
  check(read(root / L"config/config.yml") == "cookie: do-not-overwrite" && read(root / L"data/user.json") == "user-data", "preserved user files");
  rollback(root, journal);
  check(version(root) == L"9.0.0" && read(root / L"AWA-Helper.exe") == "helper 9.0.0", "rollback restored old version");
  fs::remove(root / L"README.html");
  install(root, journal); rollback(root, journal);
  check(!fs::exists(root / L"README.html"), "rollback removed newly added file");
  // A sharing violation halfway through replacement must leave a recoverable journal.
  Handle occupied(CreateFileW((root / L"AWA-Manager.exe").c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr));
  rejects([&] { install(root, journal); });
  check(readJson(root / L".update/current.json")["state"] == "installing", "failure journal is durable");
  CloseHandle(occupied.value); occupied.value = nullptr;
  rollback(root, journal);
  check(read(root / L"AWA-Helper.exe") == "helper 9.0.0", "partial install rollback");
  auto bad = readJson(stage / L"payload" / manifestName);
  bad["files"][0]["path"] = "config/config.yml";
  writeJson(stage / L"payload" / manifestName, bad);
  rejects([&] { manifest(stage / L"payload", true); });
  acquire(root);
  // A second handle cannot steal the update lock while it is inherited or live.
  Handle second(CreateFileW((root / L".update/install.lock").c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr));
  check(second.value == INVALID_HANDLE_VALUE, "exclusive installer lock");
  releaseLock(); check(!fs::exists(root / L".update/install.lock"), "lock cleaned on close");
}
void subprocessTests(const fs::path& base) {
  for (const bool valid : {true, false}) {
    const auto root = base / (valid ? L"self-update 中文 space" : L"failed-update");
    package(root, "9.0.0");
    const auto stage = root / L".update" / wide("staging-" + token());
    package(stage / L"payload", "9.1.0", valid);
    Handle process(spawn(self, L"--fixture-apply " + quote(root) + L" " + quote(stage), base));
    check(WaitForSingleObject(process.value, 20000) == WAIT_OBJECT_0, "preparer exits");
    waitState(root, valid ? "completed" : "rolled-back");
    check(version(root) == (valid ? L"9.1.0" : L"9.0.0"), "self update/rollback version");
  }
  const auto root = base / L"interrupted-update";
  package(root, "9.0.0");
  const auto stage = root / L".update" / wide("staging-" + token());
  package(stage / L"payload", "9.1.0");
  auto journal = transaction(stage);
  install(root, journal); // Simulate power loss after replacement, before health confirmation.
  Handle process(spawn(self, L"--fixture-recover " + quote(root), base));
  check(WaitForSingleObject(process.value, 20000) == WAIT_OBJECT_0, "recovery launcher exits");
  waitState(root, "rolled-back");
  check(version(root) == L"9.0.0", "restart recovers interrupted update");
}
}

int wmain(int argc, wchar_t** argv) {
  std::vector<std::wstring> args;
  for (int i = 0; i < argc; ++i) args.emplace_back(argv[i]);
  self = fs::absolute(args[0]);
  const int internal = updater::internalMode(args);
  if (internal >= 0) return internal;
  if (args.size() == 3 && args[1] == L"--update-health") { updater::healthReady(args[2]); Sleep(1000); return 0; }
  if (args.size() == 3 && args[1] == L"--update-result") return 0;
  try {
    if (args.size() == 4 && args[1] == L"--fixture-apply") {
      acquire(args[2]); updater::apply(args[2], {args[3], L""}, 0); return 0;
    }
    if (args.size() == 3 && args[1] == L"--fixture-recover") { check(updater::recover(args[2]), "recovery required"); return 0; }
    if (args.size() == 4 && args[1] == L"--extract") { updater::extract(args[2], args[3]); return 0; }
    if (args.size() == 5 && args[1] == L"--prepare") {
      const fs::path root(args[2]), archive(args[3]);
      const auto mode = args[4];
      fs::create_directories(root);
      if (mode == L"repair" || mode == L"current") package(root, "9.1.0");
      if (mode == L"upgrade") package(root, "9.0.0");
      if (mode == L"newer") package(root, "9.2.0");
      if (mode == L"repair") fs::remove(root / L"AWA-Helper.exe");
      const auto digest = sha256(archive);
      const auto assetUrl = "https://github.com/HCLonely/AWA-Helper/releases/download/v9.1.0/AWA-Helper-Win.tar.gz";
      Json info = {{"tag_name", "v9.1.0"}, {"assets", Json::array({{{"name", "AWA-Helper-Win.tar.gz"}, {"size", fs::file_size(archive)}, {"digest", "sha256:" + digest}, {"browser_download_url", assetUrl}}})}};
      if (mode == L"checksum") {
        info["assets"][0]["digest"] = nullptr;
        info["assets"].push_back({{"name", "AWA-Helper-Win.tar.gz.sha256"}, {"browser_download_url", std::string(assetUrl) + ".sha256"}});
      }
      std::vector<std::string> requests;
      requestOverride = [&](const std::string& url, const fs::path& target) {
        requests.push_back(url);
        if (url.find("api.github.com") != std::string::npos) writeJson(target, info);
        else if (url.find(".sha256") != std::string::npos) write(target, digest + "  AWA-Helper-Win.tar.gz\n");
        else fs::copy_file(archive, target, fs::copy_options::overwrite_existing);
      };
      const auto prepared = prepare(root, mode == L"repair", [](const std::wstring&) {});
      if (mode == L"current" || mode == L"newer") {
        check(prepared.stage.empty() && requests.size() == 1, "up-to-date/newer avoids downloading and downgrading");
      } else {
        check(!prepared.stage.empty(), "bootstrap/repair/upgrade prepared");
        manifest(prepared.stage / L"payload", true);
        check(requests[0] == std::string(api) + (mode == L"repair" ? "tags/v9.1.0" : "latest"), "repair uses installed version");
        releaseLock();
      }
      return 0;
    }
    const auto base = fs::absolute(L"native/windows-tray/obj") / wide("test-" + token());
    fs::create_directories(base);
    pureTests(base); std::cout << "PASS versions, paths, ordered network fallback, corrupt downloads\n";
    transactionTests(base); std::cout << "PASS transactional install, user data, file locks and rollback\n";
    subprocessTests(base); std::cout << "PASS real installer hand-off, self update, failure and interrupted recovery\n";
    // Every deletion is constrained to the newly generated test directory.
    plainFile(base); Sleep(1200); fs::remove_all(base);
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "FAIL " << error.what() << "\n";
    return 1;
  }
}
