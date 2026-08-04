$ErrorActionPreference = 'Stop'

$appPath = Split-Path -Parent $PSScriptRoot

if ($appPath.StartsWith('\\')) {
  $driveName = 'HAT'
  if (-not (Get-PSDrive -Name $driveName -ErrorAction SilentlyContinue)) {
    New-PSDrive -Name $driveName -PSProvider FileSystem -Root $appPath | Out-Null
  }
  Set-Location "$driveName`:"
} else {
  Set-Location $appPath
}

node ..\api\tests\auth-session-smoke.mjs
