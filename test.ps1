Set-Location dist
if ( -not( Test-Path ./config.yml ))
{
  $result = node index.js
  if ( ((-split $result) -join "" ) -notmatch "config.yml]!" )
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
