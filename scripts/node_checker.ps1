Write-Output 'Checking if nodejs is installed...'
$node = node -v
if ($node -notmatch 'v16\.')
{
  Write-Host "Not installed" -ForegroundColor Red
  Write-Host "Installing nodejs..." -ForegroundColor Blue
  # Download nodejs
  Start-BitsTransfer -Source "https://nodejs.org/dist/v16.17.0/node-v16.17.0-win-x64.zip" -Destination "./node-v16.17.0-win-x64.zip"
  # Expand nodejs
  Expand-Archive -Path "./node-v16.17.0-win-x64.zip" -DestinationPath "./" -Force
  # Set nodejs path to Environment
  $nodePath = Resolve-Path "./node-v16.17.0-win-x64"
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $envPath = $userPath + ';' + $nodePath
  [Environment]::SetEnvironmentVariable('Path', $envPath, 'User')
}

Write-Host "Installed" -ForegroundColor Green

Write-Output 'Checking if all dependencies are installed...'
Set-Location ..
node scripts/modules_checker.js

Write-Output 'Starting AWA-Helper...'
node index.js

if (-not (Test-Path './auto-close')) {
  pause
}
