param(
  [string]$KeystorePath,
  [string]$KeyAlias = "finance-life",
  [string]$KeystorePassword,
  [string]$KeyPassword,
  [switch]$Force
)

function Write-ErrorAndExit($msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

$repoRoot = Resolve-Path "."
$androidDir = Join-Path $repoRoot "android"
if (-not (Test-Path $androidDir)) {
  Write-ErrorAndExit "No ./android folder found. Run this script from the repository root."
}

if (-not $KeystorePath) {
  $KeystorePath = Read-Host "Keystore path"
}

if (-not (Test-Path $KeystorePath)) {
  Write-ErrorAndExit "Keystore file not found at '$KeystorePath'."
}

if (-not $KeystorePassword) {
  $secureStore = Read-Host -AsSecureString "Keystore password (hidden)"
  $KeystorePassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureStore))
}

if (-not $KeyPassword) {
  $secureKey = Read-Host -AsSecureString "Key password (hidden)"
  $KeyPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey))
}

$keyPropsPath = Join-Path $androidDir "key.properties"
if ((Test-Path $keyPropsPath) -and (-not $Force)) {
  Write-ErrorAndExit "android/key.properties already exists. Re-run with -Force to overwrite."
}

$absStoreFile = (Resolve-Path $KeystorePath).Path -replace '\\','/'
$content = @"
storeFile=$absStoreFile
storePassword=$KeystorePassword
keyAlias=$KeyAlias
keyPassword=$KeyPassword
"@

Set-Content -Path $keyPropsPath -Value $content -Encoding UTF8
Write-Host "Created android/key.properties successfully." -ForegroundColor Green
Write-Host "Reminder: android/key.properties is ignored by git and should stay local only."
