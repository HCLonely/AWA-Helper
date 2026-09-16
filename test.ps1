$ErrorActionPreference = 'Stop'

$entryPoint = Join-Path $PSScriptRoot 'output/index.js'
if (-not (Test-Path -LiteralPath $entryPoint -PathType Leaf)) {
  throw 'Build output not found: output/index.js. Run npm run build:pre first.'
}
$node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "awa-helper-smoke-$PID-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $testRoot | Out-Null
$process = $null

try {
  Copy-Item -LiteralPath $entryPoint -Destination $testRoot
  $stdout = Join-Path $testRoot 'stdout.log'
  $stderr = Join-Path $testRoot 'stderr.log'

  # Smoke test only: load the bundle without configuration or business tasks.
  $process = Start-Process -FilePath $node -ArgumentList 'index.js', '--help' `
    -WorkingDirectory $testRoot -NoNewWindow -PassThru `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $completed = $process.WaitForExit(30000)
  if (-not $completed) {
    $process.Kill()
  }
  $process.WaitForExit()

  if (-not $completed -or $process.ExitCode -ne 0) {
    Get-Content -LiteralPath $stdout, $stderr
    if (-not $completed) {
      throw 'Smoke test timed out after 30 seconds.'
    }
    throw "Smoke test failed with exit code $($process.ExitCode)."
  }
  Write-Output 'Smoke test passed: application loaded and exited successfully.'
}
finally {
  if ($null -ne $process) {
    if (-not $process.HasExited) {
      $process.Kill()
      $process.WaitForExit()
    }
    $process.Dispose()
  }
  $resolvedTemp = [System.IO.Path]::GetFullPath($testRoot)
  $systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if ((Split-Path $resolvedTemp -Parent) -eq $systemTemp.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) -and (Split-Path $resolvedTemp -Leaf).StartsWith('awa-helper-smoke-')) {
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
  }
}

exit 0
