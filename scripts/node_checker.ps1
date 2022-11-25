Write-Output 'Checking if nodejs is installed...'
$node = node -v
if ($node -notmatch 'v16\.' -or $node -notmatch 'v18\.')
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

$node1 = node -v
if ($node1 -notmatch 'v16\.' -or $node1 -notmatch 'v18\.') {
  $node2 = ./node-v18.12.1-win-x64/node -v
  if ($node2 -notmatch 'v18\.') {
    Write-Host "Installing Failed" -ForegroundColor Red
  }
  else {
    Write-Host "Installed" -ForegroundColor Green
    Write-Output 'Checking if all dependencies are installed...'
    ./node-v18.12.1-win-x64/node scripts/modules_checker.js "./node-v18.12.1-win-x64/"

    Write-Output 'Starting AWA-Helper...'
    ./node-v18.12.1-win-x64/node index.js

    if (-not (Test-Path './auto-close')) {
      pause
    }
  }
}
else
{
  Write-Host "Installed" -ForegroundColor Green
  Write-Output 'Checking if all dependencies are installed...'
  node scripts/modules_checker.js

  Write-Output 'Starting AWA-Helper...'
  node index.js

  if (-not (Test-Path './auto-close')) {
    pause
  }
}
