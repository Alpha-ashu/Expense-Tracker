This file describes how to use the `e2e-build.ps1` script to automate building debug APKs and signed release AABs for the Android app.

Files added:
- `e2e-build.ps1` - PowerShell script placed at the repo root that:
  - Optionally runs `npx cap sync android` if a Capacitor config is present
  - Creates a `android/key.properties` file from input keystore path and passwords
  - Runs Gradle (via the wrapper) to assemble debug and/or bundle release
  - Prints output file locations and removes `key.properties` by default

Usage examples (run from repo root in PowerShell):

Build debug only:

```powershell
.\e2e-build.ps1 -Debug
```

Build release only (provide keystore path and password):

```powershell
.\e2e-build.ps1 -Release -KeystorePath .\android\finance-life-release.keystore -KeystorePassword "YourPassword" -KeyPassword "YourPassword"
```

Build both (will prompt for passwords if not provided):

```powershell
.\e2e-build.ps1 -KeystorePath .\android\finance-life-release.keystore
```

Notes:
- The script writes `android/key.properties` temporarily; it will be removed after the build unless you pass `-KeepKeyProperties`.
- The `android/app/build.gradle` file was updated to read `key.properties` and wire the `signingConfig` into the `release` build type. If you already have different signing logic, reconcile the changes manually.
- Output paths (after successful build):
  - Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
  - Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`

If you need me to adapt the script to create an unsigned release APK instead, or to keep the `key.properties` file permanently, tell me which behavior you prefer.
