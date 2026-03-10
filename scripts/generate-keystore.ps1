param(
  [string]$OutputPath = ".\\secure\\finance-life-release.keystore",
  [string]$Alias = "finance-life",
  [int]$ValidityDays = 10000,
  [switch]$Force
)

function Write-ErrorAndExit($msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
  Write-ErrorAndExit "keytool not found. Install Java JDK 17+ and ensure keytool is on PATH."
}

$parentDir = Split-Path -Path $OutputPath -Parent
if (-not (Test-Path $parentDir)) {
  New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
}

if ((Test-Path $OutputPath) -and (-not $Force)) {
  Write-ErrorAndExit "Keystore already exists at '$OutputPath'. Re-run with -Force to overwrite."
}

Write-Host "Creating keystore at: $OutputPath"
Write-Host "You will be prompted by keytool for passwords and identity fields." -ForegroundColor Yellow

& keytool -genkeypair -v -keystore $OutputPath -alias $Alias -keyalg RSA -keysize 2048 -validity $ValidityDays
if ($LASTEXITCODE -ne 0) {
  Write-ErrorAndExit "keytool failed to generate the keystore."
}

Write-Host "Keystore generated successfully." -ForegroundColor Green
Write-Host "Next step: run .\\scripts\\create-key-properties.ps1 -KeystorePath '$OutputPath'"
