Set-Location output
if ( -not( Test-Path ./config.yml ))
{
  $result = ./AWA-Helper
  if ( $result -notmatch "config.yml]!" )
  {
    Write-Output $result
    throw "Test failed!"
  }
}
else
{
  throw "Please do not use the production environment for testing!"
}
Write-Output "Test success!"
