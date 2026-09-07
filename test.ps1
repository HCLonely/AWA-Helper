$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "awa-helper-smoke-$PID-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $testRoot | Out-Null

try {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'output/index.js') -Destination $testRoot
  Push-Location $testRoot
  try {
    $result = node index.js --helper 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }

  if ($exitCode -eq 0 -or ($result -join "`n") -notmatch '\[CONFIG_NOT_FOUND\]') {
    Write-Output $result
    throw 'Test failed!'
  }
  Write-Output 'Test success!'
}
finally {
  $resolvedTemp = [System.IO.Path]::GetFullPath($testRoot)
  $systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if ($resolvedTemp.StartsWith($systemTemp) -and (Split-Path $resolvedTemp -Leaf).StartsWith('awa-helper-smoke-')) {
    Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
  }
}

exit 0
