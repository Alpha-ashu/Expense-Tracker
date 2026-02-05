# Vercel Deployment Guide for FinanceLife

## Fixed Issues

The permission denied error on Vercel has been resolved by adding proper configuration files:

### Files Added:
1. **`vercel.json`** - Vercel deployment configuration with:
   - Build command and output directory
   - Rewrites for SPA routing
   - Cache headers for Service Worker and static assets
   - Proper PWA manifest configuration

2. **`.vercelignore`** - Tells Vercel which files to ignore during deployment

3. **`.nvmrc`** - Specifies Node.js version (18.19.0)

4. **`package.json` engines field** - Specifies minimum Node and npm versions

## Deployment Steps

### Via GitHub (Recommended):

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Fix: Add Vercel deployment configuration"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will automatically detect this is a Vite project

3. **Configure Build Settings (should be auto-detected):**
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Environment Variables (if needed):**
   - Add any required `.env` variables in Vercel dashboard
   - Currently not needed for basic deployment

5. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete (~2-3 minutes)

### Troubleshooting

If you still encounter issues:

1. **Clear Vercel Build Cache:**
   - Go to your project settings
   - Go to "Deployments" → "Settings"
   - Click "Clear all"
   - Redeploy

2. **Check Node Version:**
   - Vercel Settings → Node.js Version → Select 18.x
   - Save and redeploy

3. **Verify Local Build:**
   ```bash
   npm install
   npm run build
   npm run preview
   ```
   Visit `http://localhost:4173` to test the production build locally

4. **Check Logs:**
   - In Vercel dashboard, view the build logs
   - Look for any missing dependencies or build errors
   - Search for "error" or "failed" in logs

## Production Optimizations Done

✅ Service Worker properly configured for offline support
✅ PWA manifest validated
✅ Cache headers optimized for performance
✅ SPA routing configured (client-side routing works)
✅ Static assets properly cached (31 days)
✅ Service Worker never cached (always fresh)

## After Deployment

1. **Test the App:**
   - Visit your Vercel URL
   - Add some transactions
   - Test offline mode (open DevTools → Network → Offline)
   - Refresh page - data should persist

2. **Monitor Performance:**
   - Vercel Analytics shows performance metrics
   - Check Lighthouse scores
   - Monitor Core Web Vitals

3. **Custom Domain (Optional):**
   - In Vercel project settings
   - Add your custom domain
   - Update DNS records if needed

## Mobile Deployment (iOS/Android)

If you want to deploy as a native app:

```bash
# Build PWA
npm run build:pwa

# Initialize Capacitor for iOS
npm run cap:add:ios

# Initialize Capacitor for Android
npm run cap:add:android

# Open in native IDEs
npm run cap:open:ios     # Opens Xcode
npm run cap:open:android # Opens Android Studio
```

Then build and deploy using Xcode/Android Studio.

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Vite Docs:** https://vitejs.dev
- **PWA Docs:** https://web.dev/progressive-web-apps/

---

**Status:** ✅ Ready for deployment!
