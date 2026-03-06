param(
  [string]$KeystorePath,
  [string]$KeystorePassword,
  [string]$KeyAlias = "finance-life",
  [string]$KeyPassword,
  [switch]$Debug,
  [switch]$Release,
  [switch]$KeepKeyProperties
)

function Write-ErrorAndExit($msg) { Write-Host $msg -ForegroundColor Red; exit 1 }

# default: build both when no switch provided
if (-not ($Debug -or $Release)) { $Debug = $true; $Release = $true }

# ensure project android folder exists
if (-not (Test-Path -Path ".\android")) { Write-ErrorAndExit "No `./android` folder found. Run from repo root." }

# Optional: run capacitor sync if applicable
$hasCapacitor = (Test-Path -Path ".\capacitor.config.json") -or (Test-Path -Path ".\capacitor.config.ts")
if ($hasCapacitor) {
  Write-Host "Running npx cap sync android..."
  npx cap sync android
}

# create key.properties if release build requested and keystore provided
$keyPropsPath = Join-Path -Path (Resolve-Path .\android) -ChildPath "key.properties"
if ($Release) {
  if (-not $KeystorePath) { Write-ErrorAndExit "Release build requested but `-KeystorePath` not provided." }
  if (-not (Test-Path -Path $KeystorePath)) { Write-ErrorAndExit "Keystore file not found at `'$KeystorePath'`." }
  if (-not $KeystorePassword) {
    $secure = Read-Host -AsSecureString "Keystore password (will be hidden)"
    $KeystorePassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  }
  if (-not $KeyPassword) {
    $secure = Read-Host -AsSecureString "Key password (will be hidden)"
    $KeyPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  }

  # normalize path (use forward slashes to be safe for Gradle)
  $absStoreFile = (Resolve-Path $KeystorePath).Path -replace '\\','/'

  $content = @"
storeFile=$absStoreFile
storePassword=$KeystorePassword
keyAlias=$KeyAlias
keyPassword=$KeyPassword
"@

  Write-Host "Writing `key.properties` to `android`..."
  Set-Content -Path $keyPropsPath -Value $content -Encoding UTF8
}

Push-Location .\android

# choose gradle wrapper
$gradle = if (Test-Path -Path ".\gradlew.bat") { ".\gradlew.bat" } elseif (Test-Path -Path "./gradlew") { "./gradlew" } else { Write-ErrorAndExit "Gradle wrapper not found in `android`." }

if ($Debug) {
  Write-Host "Building debug APK..."
  & $gradle assembleDebug --no-daemon
  $debugPath = Resolve-Path ".\app\build\outputs\apk\debug\app-debug.apk" -ErrorAction SilentlyContinue
  if ($debugPath) { Write-Host "Debug APK: $($debugPath.Path)" } else { Write-Host "Debug APK not found in expected path." }
}

if ($Release) {
  Write-Host "Building release AAB (bundleRelease)..."
  & $gradle bundleRelease --no-daemon
  $aabPath = Resolve-Path ".\app\build\outputs\bundle\release\app-release.aab" -ErrorAction SilentlyContinue
  if ($aabPath) { Write-Host "Release AAB: $($aabPath.Path)" } else { Write-Host "Release AAB not found in expected path." }
}

Pop-Location

if ($Release -and -not $KeepKeyProperties) {
  Write-Host "Removing temporary `key.properties`..."
  Remove-Item -Path $keyPropsPath -ErrorAction SilentlyContinue
}

Write-Host "Done."
