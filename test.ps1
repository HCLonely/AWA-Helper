$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "awa-helper-smoke-$PID-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $testRoot | Out-Null

try {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'output/index.js') -Destination $testRoot
  Push-Location $testRoot
  try {
    $result = node index.js --helper 2>&1
  }
  finally {
    Pop-Location
  }

  if (((-split $result) -join '') -notmatch 'config.yml]!') {
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
