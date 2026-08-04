param(
  [int]$Port = 4173
)

$repoPath = Split-Path -Parent $PSScriptRoot

if ($repoPath.StartsWith('\\')) {
  $driveName = 'PWT'
  if (-not (Get-PSDrive -Name $driveName -ErrorAction SilentlyContinue)) {
    New-PSDrive -Name $driveName -PSProvider FileSystem -Root $repoPath | Out-Null
  }
  Set-Location "$driveName`:"
} else {
  Set-Location $repoPath
}

$env:PLAYWRIGHT_SMOKE_MODE = '1'
node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port $Port --configLoader runner