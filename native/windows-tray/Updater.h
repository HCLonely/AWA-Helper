#pragma once
#include <windows.h>
#include <filesystem>
#include <functional>
#include <string>
#include <vector>

namespace updater {
using Progress = std::function<void(const std::wstring&)>;
struct Prepared {
  std::filesystem::path stage;
  std::wstring message;
};
// Internal modes run before the normal tray singleton is acquired.
int internalMode(const std::vector<std::wstring>& args);
bool recover(const std::filesystem::path& root);
bool complete(const std::filesystem::path& root);
Prepared prepare(const std::filesystem::path& root, bool repair, const Progress& progress);
void apply(const std::filesystem::path& root, const Prepared& prepared, DWORD helperPid);
void releaseLock();
std::wstring version(const std::filesystem::path& root);
void healthReady(const std::wstring& eventName);
void validateHealth(const std::filesystem::path& root, const std::wstring& eventName);
void markTray(const std::filesystem::path& root);
void unmarkTray(const std::filesystem::path& root);
// Pure validation functions are also used by the native regression tests.
int compareVersions(std::string left, std::string right);
std::string safePath(std::string value);
std::vector<std::string> sources(const std::string& original);
void extract(const std::filesystem::path& archive, const std::filesystem::path& destination);
}
