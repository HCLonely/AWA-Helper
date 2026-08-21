#include <windows.h>
#include <shellapi.h>

#include <atomic>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>

#include "resource.h"

namespace {
constexpr UINT kTrayCallback = WM_APP + 1;
constexpr UINT kChildReady = WM_APP + 2;
constexpr UINT kChildExited = WM_APP + 3;
constexpr UINT kChildError = WM_APP + 4;
constexpr UINT kChildStatus = WM_APP + 5;
constexpr UINT kOpenWebUi = 1001;
constexpr UINT kOpenLogs = 1002;
constexpr UINT kExitManager = 1003;
constexpr UINT kShowStatus = 1004;
constexpr UINT kToggleHelper = 1005;
constexpr UINT kToggleAchievement = 1006;
constexpr UINT kToggleAutoStart = 1007;
constexpr wchar_t kWindowClass[] = L"AWAHelperManagerTrayWindow";
constexpr wchar_t kAutoStartKey[] = L"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
constexpr wchar_t kAutoStartValue[] = L"AWA-Manager";
HINSTANCE instanceHandle = nullptr;
HWND windowHandle = nullptr;
NOTIFYICONDATAW trayIcon{};
HANDLE childProcess = nullptr;
HANDLE childInput = nullptr;
HANDLE childOutput = nullptr;
std::atomic<bool> childRunning{false};
std::atomic<bool> shutdownRequested{false};
std::atomic<bool> managerReady{false};
std::mutex stateMutex;
std::wstring webUiUrl;
std::wstring dailyQuestStatus = L"idle";
std::wstring achievementStatus = L"idle";
std::wstring artifactStatus = L"idle";
DWORD childExitCode = 0;

std::wstring executableDirectory() {
  std::wstring path(32768, L'\0');
  const DWORD length = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
  path.resize(length);
  const size_t separator = path.find_last_of(L"\\/");
  return separator == std::wstring::npos ? L"." : path.substr(0, separator);
}

std::wstring executablePath() {
  std::wstring path(32768, L'\0');
  const DWORD length = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
  path.resize(length);
  return path;
}

std::wstring utf8ToWide(const std::string& value) {
  if (value.empty()) {
    return {};
  }
  const int length = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (length <= 0) {
    return {};
  }
  std::wstring converted(static_cast<size_t>(length), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), converted.data(), length);
  return converted;
}

void setTooltip(const wchar_t* text) {
  trayIcon.uFlags = NIF_TIP | NIF_SHOWTIP;
  lstrcpynW(trayIcon.szTip, text, ARRAYSIZE(trayIcon.szTip));
  Shell_NotifyIconW(NIM_MODIFY, &trayIcon);
}

void showNotification(const wchar_t* title, const wchar_t* message, DWORD flags = NIIF_INFO) {
  trayIcon.uFlags = NIF_INFO;
  trayIcon.dwInfoFlags = flags;
  lstrcpynW(trayIcon.szInfoTitle, title, ARRAYSIZE(trayIcon.szInfoTitle));
  lstrcpynW(trayIcon.szInfo, message, ARRAYSIZE(trayIcon.szInfo));
  Shell_NotifyIconW(NIM_MODIFY, &trayIcon);
}

const wchar_t* localizedStatus(const std::wstring& status) {
  if (status == L"running") return L"运行中";
  if (status == L"stopping") return L"正在停止";
  if (status == L"completed") return L"已完成";
  if (status == L"failed") return L"失败";
  if (status == L"cancelled") return L"已取消";
  return L"空闲";
}

std::wstring currentStatusText() {
  std::lock_guard<std::mutex> lock(stateMutex);
  const wchar_t* managerStatus = !childRunning
    ? L"已停止"
    : shutdownRequested ? L"正在退出" : managerReady ? L"运行中" : L"正在启动";
  return std::wstring(L"Manager：") + managerStatus +
    L"\nHelper：" + localizedStatus(dailyQuestStatus) +
    L"\nAchievement：" + localizedStatus(achievementStatus) +
    L"\nArtifact：" + localizedStatus(artifactStatus);
}

void showCurrentStatus() {
  const std::wstring status = currentStatusText();
  showNotification(L"AWA-Helper 当前状态", status.c_str(), NIIF_INFO);
}

bool autoStartEnabled() {
  DWORD bytes = 0;
  const LSTATUS sizeResult = RegGetValueW(HKEY_CURRENT_USER, kAutoStartKey, kAutoStartValue,
    RRF_RT_REG_SZ, nullptr, nullptr, &bytes);
  if (sizeResult != ERROR_SUCCESS || bytes < sizeof(wchar_t)) {
    return false;
  }
  std::wstring value(bytes / sizeof(wchar_t), L'\0');
  if (RegGetValueW(HKEY_CURRENT_USER, kAutoStartKey, kAutoStartValue,
      RRF_RT_REG_SZ, nullptr, value.data(), &bytes) != ERROR_SUCCESS) {
    return false;
  }
  value.resize(wcsnlen_s(value.c_str(), value.size()));
  return _wcsicmp(value.c_str(), (L"\"" + executablePath() + L"\"").c_str()) == 0;
}

bool setAutoStart(bool enabled) {
  HKEY key = nullptr;
  if (RegCreateKeyExW(HKEY_CURRENT_USER, kAutoStartKey, 0, nullptr, 0, KEY_SET_VALUE,
      nullptr, &key, nullptr) != ERROR_SUCCESS) {
    return false;
  }
  LSTATUS result = ERROR_SUCCESS;
  if (enabled) {
    const std::wstring command = L"\"" + executablePath() + L"\"";
    result = RegSetValueExW(key, kAutoStartValue, 0, REG_SZ,
      reinterpret_cast<const BYTE*>(command.c_str()),
      static_cast<DWORD>((command.size() + 1) * sizeof(wchar_t)));
  } else {
    result = RegDeleteValueW(key, kAutoStartValue);
    if (result == ERROR_FILE_NOT_FOUND) {
      result = ERROR_SUCCESS;
    }
  }
  RegCloseKey(key);
  return result == ERROR_SUCCESS;
}

void toggleAutoStart() {
  const bool enable = !autoStartEnabled();
  if (setAutoStart(enable)) {
    showNotification(L"AWA-Manager", enable ? L"已启用开机自启。" : L"已关闭开机自启。", NIIF_INFO);
  } else {
    showNotification(L"AWA-Manager", L"无法更新开机自启设置。", NIIF_ERROR);
  }
}

void updateStatusTooltip() {
  std::lock_guard<std::mutex> lock(stateMutex);
  const std::wstring tooltip = std::wstring(L"AWA-Manager\r\nHelper：") + localizedStatus(dailyQuestStatus) +
    L"\r\nAchievement：" + localizedStatus(achievementStatus) +
    L"\r\nArtifact：" + localizedStatus(artifactStatus);
  setTooltip(tooltip.c_str());
}

void openPath(const std::wstring& path) {
  ShellExecuteW(windowHandle, L"open", path.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

void openWebUi() {
  std::lock_guard<std::mutex> lock(stateMutex);
  if (!webUiUrl.empty()) {
    openPath(webUiUrl);
  } else if (childRunning) {
    showNotification(L"AWA-Helper", L"WebUI 未启用或仍在启动。", NIIF_WARNING);
  } else {
    showNotification(L"AWA-Helper", L"Manager 当前未运行。", NIIF_ERROR);
  }
}

bool writeChildCommand(const char* command) {
  if (childInput == nullptr) {
    return false;
  }
  DWORD written = 0;
  return WriteFile(childInput, command, static_cast<DWORD>(strlen(command)), &written, nullptr) != FALSE;
}

void requestChildShutdown() {
  if (!childRunning) {
    DestroyWindow(windowHandle);
    return;
  }
  if (shutdownRequested.exchange(true)) {
    return;
  }
  setTooltip(L"AWA-Helper - 正在退出...");
  if (!writeChildCommand("shutdown\n")) {
    showNotification(L"AWA-Helper", L"无法发送退出请求，请稍后重试。", NIIF_ERROR);
    shutdownRequested = false;
  }
}

void handleProtocolLine(const std::string& line) {
  constexpr char prefix[] = "@@AWA-TRAY\t";
  if (line.rfind(prefix, 0) != 0) {
    return;
  }
  const std::string payload = line.substr(sizeof(prefix) - 1);
  constexpr char readyPrefix[] = "READY\t";
  if (payload.rfind(readyPrefix, 0) == 0) {
    {
      std::lock_guard<std::mutex> lock(stateMutex);
      webUiUrl = utf8ToWide(payload.substr(sizeof(readyPrefix) - 1));
    }
    PostMessageW(windowHandle, kChildReady, 0, 0);
  } else if (payload.rfind("STATUS\t", 0) == 0) {
    size_t start = sizeof("STATUS\t") - 1;
    while (start <= payload.size()) {
      const size_t end = payload.find('\t', start);
      const std::string field = payload.substr(start, end == std::string::npos ? end : end - start);
      const size_t separator = field.find('=');
      if (separator != std::string::npos) {
        const std::wstring name = utf8ToWide(field.substr(0, separator));
        const std::wstring status = utf8ToWide(field.substr(separator + 1));
        std::lock_guard<std::mutex> lock(stateMutex);
        if (name == L"dailyQuest") dailyQuestStatus = status;
        else if (name == L"achievement") achievementStatus = status;
        else if (name == L"artifact") artifactStatus = status;
      }
      if (end == std::string::npos) break;
      start = end + 1;
    }
    PostMessageW(windowHandle, kChildStatus, 0, 0);
  } else if (payload == "ERROR") {
    PostMessageW(windowHandle, kChildError, 0, 0);
  }
}

void readChildOutput() {
  std::string pending;
  char buffer[4096];
  DWORD bytesRead = 0;
  while (ReadFile(childOutput, buffer, sizeof(buffer), &bytesRead, nullptr) && bytesRead > 0) {
    pending.append(buffer, bytesRead);
    size_t newline = std::string::npos;
    while ((newline = pending.find('\n')) != std::string::npos) {
      std::string line = pending.substr(0, newline);
      if (!line.empty() && line.back() == '\r') {
        line.pop_back();
      }
      handleProtocolLine(line);
      pending.erase(0, newline + 1);
    }
  }
}

bool launchManager() {
  SECURITY_ATTRIBUTES security{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
  HANDLE childStdinRead = nullptr;
  HANDLE childStdoutWrite = nullptr;
  if (!CreatePipe(&childStdinRead, &childInput, &security, 0) ||
      !SetHandleInformation(childInput, HANDLE_FLAG_INHERIT, 0) ||
      !CreatePipe(&childOutput, &childStdoutWrite, &security, 0) ||
      !SetHandleInformation(childOutput, HANDLE_FLAG_INHERIT, 0)) {
    return false;
  }

  const std::wstring directory = executableDirectory();
  const std::wstring corePath = directory + L"\\AWA-Helper.exe";
  std::wstring commandLine = L"\"" + corePath + L"\" --manager --tray-child";
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
  startup.wShowWindow = SW_HIDE;
  startup.hStdInput = childStdinRead;
  startup.hStdOutput = childStdoutWrite;
  startup.hStdError = childStdoutWrite;
  PROCESS_INFORMATION process{};
  const BOOL started = CreateProcessW(
    corePath.c_str(), commandLine.data(), nullptr, nullptr, TRUE,
    CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT, nullptr, directory.c_str(), &startup, &process
  );
  CloseHandle(childStdinRead);
  CloseHandle(childStdoutWrite);
  if (!started) {
    CloseHandle(childInput);
    CloseHandle(childOutput);
    childInput = nullptr;
    childOutput = nullptr;
    return false;
  }

  CloseHandle(process.hThread);
  childProcess = process.hProcess;
  childRunning = true;
  std::thread(readChildOutput).detach();
  std::thread([] {
    WaitForSingleObject(childProcess, INFINITE);
    GetExitCodeProcess(childProcess, &childExitCode);
    childRunning = false;
    PostMessageW(windowHandle, kChildExited, 0, 0);
  }).detach();
  return true;
}

void showContextMenu() {
  const HMENU menu = CreatePopupMenu();
  bool webUiReady = false;
  bool helperActive = false;
  bool achievementActive = false;
  bool helperStopping = false;
  bool achievementStopping = false;
  {
    std::lock_guard<std::mutex> lock(stateMutex);
    webUiReady = !webUiUrl.empty();
    helperActive = dailyQuestStatus == L"running" || dailyQuestStatus == L"stopping";
    achievementActive = achievementStatus == L"running" || achievementStatus == L"stopping";
    helperStopping = dailyQuestStatus == L"stopping";
    achievementStopping = achievementStatus == L"stopping";
  }
  const bool controlsEnabled = managerReady && childRunning && !shutdownRequested;
  AppendMenuW(menu, MF_STRING | (webUiReady ? MF_ENABLED : MF_GRAYED), kOpenWebUi, L"打开管理页面");
  AppendMenuW(menu, MF_STRING, kShowStatus, L"查看运行状态");
  AppendMenuW(menu, MF_STRING, kOpenLogs, L"打开日志目录");
  const bool autoStart = autoStartEnabled();
  AppendMenuW(menu, MF_STRING | (autoStart ? MF_CHECKED : MF_UNCHECKED), kToggleAutoStart,
    autoStart ? L"开机自启（已启用）" : L"开机自启（未启用）");
  AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
  AppendMenuW(menu, MF_STRING | (controlsEnabled && !helperStopping ? MF_ENABLED : MF_GRAYED),
    kToggleHelper, helperActive ? L"停止Helper" : L"启动Helper");
  AppendMenuW(menu, MF_STRING | (controlsEnabled && !achievementStopping ? MF_ENABLED : MF_GRAYED),
    kToggleAchievement, achievementActive ? L"停止Achievement" : L"启动Achievement");
  AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
  AppendMenuW(menu, MF_STRING, kExitManager, L"退出AWA-Manager");
  POINT cursor{};
  GetCursorPos(&cursor);
  SetForegroundWindow(windowHandle);
  TrackPopupMenu(menu, TPM_RIGHTBUTTON | TPM_BOTTOMALIGN | TPM_LEFTALIGN, cursor.x, cursor.y, 0, windowHandle, nullptr);
  DestroyMenu(menu);
}

LRESULT CALLBACK windowProcedure(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
  switch (message) {
    case kTrayCallback:
      if (LOWORD(lParam) == WM_LBUTTONDBLCLK) {
        openWebUi();
      } else if (LOWORD(lParam) == WM_CONTEXTMENU || LOWORD(lParam) == WM_RBUTTONUP) {
        showContextMenu();
      }
      return 0;
    case WM_COMMAND:
      switch (LOWORD(wParam)) {
        case kOpenWebUi:
          openWebUi();
          break;
        case kOpenLogs:
          openPath(executableDirectory() + L"\\logs");
          break;
        case kShowStatus:
          showCurrentStatus();
          break;
        case kToggleHelper: {
          std::lock_guard<std::mutex> lock(stateMutex);
          const bool active = dailyQuestStatus == L"running" || dailyQuestStatus == L"stopping";
          writeChildCommand(active ? "stop-helper\n" : "start-helper\n");
          break;
        }
        case kToggleAchievement: {
          std::lock_guard<std::mutex> lock(stateMutex);
          const bool active = achievementStatus == L"running" || achievementStatus == L"stopping";
          writeChildCommand(active ? "stop-achievement\n" : "start-achievement\n");
          break;
        }
        case kToggleAutoStart:
          toggleAutoStart();
          break;
        case kExitManager:
          requestChildShutdown();
          break;
      }
      return 0;
    case kChildReady: {
      managerReady = true;
      std::lock_guard<std::mutex> lock(stateMutex);
      if (webUiUrl.empty()) {
        setTooltip(L"AWA-Helper - 运行中（WebUI 已禁用）");
        showNotification(L"AWA-Helper", L"Manager 已启动，WebUI 当前未启用。", NIIF_INFO);
      } else {
        setTooltip(L"AWA-Helper - 运行中");
        showNotification(L"AWA-Helper", L"Manager 已在后台启动。双击图标打开管理页面。", NIIF_INFO);
      }
      return 0;
    }
    case kChildStatus:
      if (managerReady && !shutdownRequested) {
        updateStatusTooltip();
      }
      return 0;
    case kChildError:
      setTooltip(L"AWA-Helper - 运行错误");
      return 0;
    case kChildExited:
      managerReady = false;
      if (shutdownRequested) {
        DestroyWindow(hwnd);
      } else {
        setTooltip(L"AWA-Helper - 已停止");
        const wchar_t* messageText = childExitCode == 0
          ? L"Manager 已停止。"
          : L"Manager 启动或运行失败，请打开日志目录查看详情。";
        showNotification(L"AWA-Helper", messageText, childExitCode == 0 ? NIIF_INFO : NIIF_ERROR);
      }
      return 0;
    case WM_QUERYENDSESSION:
      writeChildCommand("shutdown\n");
      return TRUE;
    case WM_DESTROY:
      Shell_NotifyIconW(NIM_DELETE, &trayIcon);
      PostQuitMessage(0);
      return 0;
    default:
      return DefWindowProcW(hwnd, message, wParam, lParam);
  }
}

bool createTrayWindow() {
  WNDCLASSEXW windowClass{};
  windowClass.cbSize = sizeof(windowClass);
  windowClass.lpfnWndProc = windowProcedure;
  windowClass.hInstance = instanceHandle;
  windowClass.hIcon = LoadIconW(instanceHandle, MAKEINTRESOURCEW(IDI_AWA_MANAGER));
  windowClass.lpszClassName = kWindowClass;
  if (!RegisterClassExW(&windowClass)) {
    return false;
  }
  windowHandle = CreateWindowExW(0, kWindowClass, L"AWA-Helper Manager", 0, 0, 0, 0, 0,
    HWND_MESSAGE, nullptr, instanceHandle, nullptr);
  if (!windowHandle) {
    return false;
  }
  trayIcon.cbSize = sizeof(trayIcon);
  trayIcon.hWnd = windowHandle;
  trayIcon.uID = 1;
  trayIcon.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP;
  trayIcon.uCallbackMessage = kTrayCallback;
  trayIcon.hIcon = LoadIconW(instanceHandle, MAKEINTRESOURCEW(IDI_AWA_MANAGER));
  lstrcpynW(trayIcon.szTip, L"AWA-Helper - 正在启动...", ARRAYSIZE(trayIcon.szTip));
  if (!Shell_NotifyIconW(NIM_ADD, &trayIcon)) {
    return false;
  }
  trayIcon.uVersion = NOTIFYICON_VERSION_4;
  Shell_NotifyIconW(NIM_SETVERSION, &trayIcon);
  return true;
}
} // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
  instanceHandle = instance;
  const HANDLE singleton = CreateMutexW(nullptr, TRUE, L"Local\\AWAHelperManagerTray");
  if (!singleton || GetLastError() == ERROR_ALREADY_EXISTS) {
    MessageBoxW(nullptr, L"AWA-Manager 托盘程序已经在运行。", L"AWA-Helper", MB_OK | MB_ICONINFORMATION);
    if (singleton) {
      CloseHandle(singleton);
    }
    return 0;
  }
  if (!createTrayWindow()) {
    MessageBoxW(nullptr, L"无法创建任务栏托盘图标。", L"AWA-Helper", MB_OK | MB_ICONERROR);
    CloseHandle(singleton);
    return 1;
  }
  if (!launchManager()) {
    setTooltip(L"AWA-Helper - 启动失败");
    showNotification(L"AWA-Helper", L"无法启动 AWA-Helper.exe，请确认两个程序位于同一目录。", NIIF_ERROR);
  }

  MSG message{};
  while (GetMessageW(&message, nullptr, 0, 0) > 0) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }
  if (childInput) {
    CloseHandle(childInput);
  }
  if (childOutput) {
    CloseHandle(childOutput);
  }
  if (childProcess) {
    CloseHandle(childProcess);
  }
  CloseHandle(singleton);
  return 0;
}
