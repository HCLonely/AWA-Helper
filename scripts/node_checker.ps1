Write-Output 'Checking if nodejs is installed...'
$global_node = node -v
$local_node = ./node/node -v
if ($global_node -notmatch 'v1(6|8)\.' -and $local_node -notmatch 'v1(6|8)\.')
{
  Write-Host "Not installed" -ForegroundColor Red
  Write-Host "Installing nodejs..." -ForegroundColor Blue
  # Download nodejs
  Start-BitsTransfer -Source "https://nodejs.org/dist/v18.12.1/node-v18.12.1-win-x64.zip" -Destination "./node-v18.12.1-win-x64.zip"
  # Expand nodejs
  Expand-Archive -Path "./node-v18.12.1-win-x64.zip" -DestinationPath "./" -Force
  # Set nodejs path to Environment
  $nodePath = Resolve-Path "./node-v18.12.1-win-x64"
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $envPath = $userPath + ';' + $nodePath
  [Environment]::SetEnvironmentVariable('Path', $envPath, 'User')
}

$global_node = node -v
if ($global_node -notmatch 'v1(6|8)\.') {
  $nodePath = Resolve-Path "./node-v18.12.1-win-x64"
  New-Item -Path ./node -ItemType SymbolicLink -Value $nodePath
  $local_node = ./node/node -v
  if ($local_node -notmatch 'v1(6|8)\.') {
    Write-Host "Installing Failed" -ForegroundColor Red
  }
  else {
    Remove-Item "./node-v18.12.1-win-x64.zip"
    Write-Host "Installed" -ForegroundColor Green
    Write-Output 'Checking if all dependencies are installed...'
    ./node/node scripts/modules_checker.js "./node/"

    Write-Output 'Starting AWA-Helper...'
    ./node/node index.js

    if (-not (Test-Path './auto-close')) {
      pause
    }
  }
}
else
{
  Remove-Item "./node-v18.12.1-win-x64.zip"
  Write-Host "Installed" -ForegroundColor Green
  Write-Output 'Checking if all dependencies are installed...'
  node scripts/modules_checker.js

  Write-Output 'Starting AWA-Helper...'
  node index.js

  if (-not (Test-Path './auto-close')) {
    pause
  }
}
