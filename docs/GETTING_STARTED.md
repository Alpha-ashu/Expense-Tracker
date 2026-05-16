#  Getting Started - Android Build System

**Welcome!** You have a complete Android build automation system ready to use.

Choose your path below:

---

##  I Have 2 Minutes

**Just want to build?**

```powershell
# From repo root in PowerShell:
.\e2e-build.ps1 -Debug
```

Done! Check: `android/app/build/outputs/apk/debug/app-debug.apk`

 See [ANDROID_BUILD_QUICK_REF.md](ANDROID_BUILD_QUICK_REF.md) for more commands.

---

##  I Have 5 Minutes

**Want to understand the basics?**

1. Read this file (you're reading it!)
2. Skim [ANDROID_BUILD_QUICK_REF.md](ANDROID_BUILD_QUICK_REF.md)
3. Try: `.\e2e-build.ps1 -Debug`
4. Verify APK was created

**Next:** See [ANDROID_BUILD_INDEX.md](ANDROID_BUILD_INDEX.md) for all options.

---

##  I Have 15 Minutes

**Want to set up CI/CD?**

1. Read [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) (~10 min)
2. Add 3 GitHub Secrets
3. Push to main/master
4. Check GitHub Actions tab for build

**Done!** Automated builds are now active.

---

##  I Have 30 Minutes

**Want to understand everything?**

1. **Read (5 min):** [ANDROID_BUILD_QUICK_REF.md](ANDROID_BUILD_QUICK_REF.md)
2. **Try (5 min):** `.\e2e-build.ps1 -Debug`
3. **Read (10 min):** [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md)
4. **Setup (10 min):** [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)

**Bonus:** [ANDROID_BUILD_ARCHITECTURE.md](ANDROID_BUILD_ARCHITECTURE.md) has diagrams.

---

##  Quick Links by Role

###  Developer
- **Build locally:** `.\e2e-build.ps1 -Debug`
- **Quick ref:** [ANDROID_BUILD_QUICK_REF.md](ANDROID_BUILD_QUICK_REF.md)
- **Help:** [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md)

###  DevOps / Tech Lead
- **Setup CI/CD:** [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)
- **Understand it:** [ANDROID_BUILD_IMPLEMENTATION_SUMMARY.md](ANDROID_BUILD_IMPLEMENTATION_SUMMARY.md)
- **Visualize:** [ANDROID_BUILD_ARCHITECTURE.md](ANDROID_BUILD_ARCHITECTURE.md)

###  Everyone
- **Navigation hub:** [ANDROID_BUILD_INDEX.md](ANDROID_BUILD_INDEX.md)
- **Master summary:** [FINAL_SUMMARY.md](FINAL_SUMMARY.md)

---

##  What You Have

###  Local Build Script
- File: `e2e-build.ps1`
- Does: Automates debug/release builds
- Try: `.\e2e-build.ps1 -Debug`

###  CI/CD Workflow
- File: `.github/workflows/build-android-aab.yml`
- Does: Auto-builds on push
- Setup: [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)

###  Documentation (6 Guides)
- **Quick:** 2-minute reference
- **Full:** Comprehensive guide
- **Setup:** Step-by-step CI/CD
- **Tech:** Implementation details
- **Visual:** Architecture diagrams
- **Hub:** Master index

---

##  Your First Build (3 Steps)

**Step 1:** Open PowerShell in repo root

**Step 2:** Run:
```powershell
.\e2e-build.ps1 -Debug
```

**Step 3:** Check output:
```
Debug APK: K:\Project\...\android\app\build\outputs\apk\debug\app-debug.apk
Done.
```

 You have successfully built an APK!

---

##  Common Questions

**Q: Where's the APK?**
A: `android/app/build/outputs/apk/debug/app-debug.apk`

**Q: How do I build release?**
A: `.\e2e-build.ps1 -Release -KeystorePath .\android\finance-life-release.keystore`

**Q: How do I set up GitHub automation?**
A: [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)

**Q: What if the build fails?**
A: [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md)  Troubleshooting

**Q: Where do I find everything?**
A: [ANDROID_BUILD_INDEX.md](ANDROID_BUILD_INDEX.md) (master hub)

---

##  Documentation Map

```
START HERE (This Page)
    
For quick command reference?
     ANDROID_BUILD_QUICK_REF.md
    
For full setup guide?
     ANDROID_BUILD_GUIDE.md
    
For CI/CD setup?
     GITHUB_ACTIONS_SETUP.md
    
Need everything?
     ANDROID_BUILD_INDEX.md (master hub)
    
Want technical deep-dive?
     ANDROID_BUILD_IMPLEMENTATION_SUMMARY.md
    
Want to see diagrams?
     ANDROID_BUILD_ARCHITECTURE.md
```

---

##  Next Steps

### Immediately
```powershell
.\e2e-build.ps1 -Debug
```
 Build your first APK

### Within 10 Minutes
Read: [ANDROID_BUILD_QUICK_REF.md](ANDROID_BUILD_QUICK_REF.md)
 Learn common commands

### Within 1 Hour (Optional)
Follow: [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)
 Enable automatic CI/CD builds

### Within 1 Day (Optional)
Read: [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md)
 Understand the full system

---

##  Key Commands

```powershell
# Build debug APK
.\e2e-build.ps1 -Debug

# Build release AAB (with signing)
.\e2e-build.ps1 -Release -KeystorePath .\android\finance-life-release.keystore

# Build both
.\e2e-build.ps1 -KeystorePath .\android\finance-life-release.keystore

# Clean Gradle
cd android
./gradlew clean
./gradlew assembleDebug

# Open Android Studio
npx cap open android
```

---

##  You're Ready!

Everything is set up. You can now:
-  Build APKs locally
-  Build signed AABs for Play Store
-  Set up automated CI/CD
-  Download artifacts from GitHub
-  Manage builds securely

**Start here:** [ANDROID_BUILD_QUICK_REF.md](ANDROID_BUILD_QUICK_REF.md)

---

##  Welcome to Automated Android Builds!

Questions? Check the docs:
- Quick help: [ANDROID_BUILD_QUICK_REF.md](ANDROID_BUILD_QUICK_REF.md)
- Detailed help: [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md)
- Everything: [ANDROID_BUILD_INDEX.md](ANDROID_BUILD_INDEX.md)

**Happy building!** 
