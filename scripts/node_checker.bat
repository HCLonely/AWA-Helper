cd "%~dp0"
echo "Checking if nodejs is installed..."
for /f "delims=" %%t in ('node -v') do set global_node=%%t
for /f "delims=" %%t in ('..\node\node -v') do set local_node=%%t
echo "%global_node:~1,2%"

if /i "%global_node:~1,2%" geq "16" (
  echo "Checking if all dependencies are installed..."
  node "modules_checker.js"
  echo "Starting AWA-Helper..."
  node "index.js"
  exit "0"
) else if "%local_node:~1,2%" geq "16" (
  echo "Checking if all dependencies are installed..."
  ..\node\node "modules_checker.js" "%~dp0../node/"
  echo "Starting AWA-Helper..."
  cd ..
  .\node\node "index.js"
  exit "0"
) else (
  echo "Not installed"
  echo "Installing nodejs..."
  mshta vbscript:msgbox^(Replace^("The NodeJs program will be downloaded automatically, and since the Powershell environment is not detected, cmd will be called to download it.\nThis operation will be blocked by antivirus, please allow!\nIf you don't trust this program, please download and install NodeJs yourself!","\n",vbCrLf^),0,"AWA-Helper"^)^(window.close^)
  mkdir "%~dp0temp\"
  where "bitsadmin" && (
    bitsadmin /transfer "Download NodeJS" https://nodejs.org/dist/v18.12.1/node-v18.12.1-win-x64.zip "%~dp0..\node-v18.12.1-win-x64.zip"
    bitsadmin /transfer "Download NodeJS" https://www.7-zip.org/a/7zr.exe "%~dp0temp\7zr.exe"
    bitsadmin /transfer "Download NodeJS" https://www.7-zip.org/a/7z2201-extra.7z "%~dp0temp\7z2201-extra.7z"
    ) || where "certutil" && (
    certutil -url""""cache  -split -f https://nodejs.org/dist/v18.12.1/node-v18.12.1-win-x64.zip node-v18.12.1-win-x64.zip
    certutil -url""""cache  -split -f https://www.7-zip.org/a/7zr.exe "%~dp0temp\7zr.exe"
    certutil -url""""cache  -split -f https://www.7-zip.org/a/7z2201-extra.7z "%~dp0temp\7z2201-extra.7z"
  ) || echo "Download failed!"

  if exist "%~dp0..\node-v18.12.1-win-x64.zip" (
    mkdir "%~dp0..\node-v18.12.1-win-x64"
    "%~dp0temp\7zr.exe" x "%~dp0temp\7z2201-extra.7z" -o"%~dp0temp\" -y -aoa
    "%~dp0temp\7za.exe" x "%~dp0..\node-v18.12.1-win-x64.zip" -o"%~dp0..\" -aoa
    mklink /D "%~dp0..\node" "%~dp0..\node-v18.12.1-win-x64"

    rmdir /s/q "%~dp0temp\"
    del /f/q "%~dp0..\node-v18.12.1-win-x64.zip"

    setlocal enabledelayedexpansion
    for /f "delims=" %%t in ('..\node\node -v') do set local_node=%%t

    echo "!local_node!"
    if "!local_node:~1,2!" geq "16" (
      echo "Checking if all dependencies are installed..."
      ..\node\node "modules_checker.js" "%~dp0../node/"
      echo "Starting AWA-Helper..."
      cd ..
      .\node\node "index.js"
      exit "0"
    ) else (
      echo "Installing Failed"
      pause
    )
  ) else (
    echo "Download Failed: https://nodejs.org/dist/v18.12.1/node-v18.12.1-win-x64.zip"
    pause
  )
)
