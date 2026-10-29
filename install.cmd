@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "AWA_EXIT_CODE=%ERRORLEVEL%"
if not "%AWA_EXIT_CODE%"=="0" pause
exit /b %AWA_EXIT_CODE%
