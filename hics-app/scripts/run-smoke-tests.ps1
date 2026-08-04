param(
  [string]$TempDir = (Join-Path $env:TEMP 'hics-app-smoke')
)

$ErrorActionPreference = 'Stop'

$sourceDir = Split-Path -Parent $PSScriptRoot

if (Test-Path $TempDir) {
  Remove-Item $TempDir -Recurse -Force
}

New-Item -ItemType Directory -Path $TempDir | Out-Null

Write-Host "Mirroring app to $TempDir"
robocopy $sourceDir $TempDir /MIR /XD node_modules dist test-results .git | Out-Null

Push-Location $TempDir

try {
  Write-Host 'Installing dependencies'
  npm ci

  Write-Host 'Ensuring Chromium is installed'
  npx playwright install chromium

  Remove-Item Env:PLAYWRIGHT_BASE_URL -ErrorAction Ignore

  Write-Host 'Running smoke suite'
  npx playwright test
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}