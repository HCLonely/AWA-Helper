/**
 * @file native/windows-tray/Updater.h
 * @description 声明 Windows 更新器模式与校验接口。
 */
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
// 内部模式在获取常规托盘单例之前运行。
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
// 这些纯校验函数也供原生回归测试使用。
int compareVersions(std::string left, std::string right);
std::string safePath(std::string value);
std::vector<std::string> sources(const std::string& original);
void extract(const std::filesystem::path& archive, const std::filesystem::path& destination);
}
