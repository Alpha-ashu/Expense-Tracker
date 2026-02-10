# Email Confirmation Fix Guide

## Issue
When users click the email confirmation link from Supabase, they get redirected to `localhost` which causes an "ERR_CONNECTION_REFUSED" error in production.

## Solution Implemented

### 1. Code Changes ✅
- Created `AuthCallback.tsx` component to handle email verification
- Updated `signUp()` function to include `emailRedirectTo` parameter
- Added `VITE_APP_URL` environment variable
- Added automatic detection of auth callback in App.tsx

### 2. Required: Configure Supabase Dashboard

You need to configure the redirect URLs in your Supabase project dashboard:

#### Step 1: Go to Supabase Dashboard
1. Visit https://supabase.com/dashboard
2. Select your project: `mmwrckfqeqjfqciymemh`
3. Navigate to **Authentication** → **URL Configuration**

#### Step 2: Configure Redirect URLs

**Site URL:**
```
Production: https://your-app.vercel.app
Development: http://localhost:5173
```

**Redirect URLs (Add all these):**
```
http://localhost:5173
http://localhost:5173/**
https://your-app.vercel.app
https://your-app.vercel.app/**
```

#### Step 3: Update Environment Variables

**Local Development (.env):**
```env
VITE_APP_URL=http://localhost:5173
```

**Vercel Production:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   ```
   VITE_APP_URL=https://your-app.vercel.app
   ```
3. Redeploy

### 3. How It Works

1. **User signs up** → Supabase sends confirmation email
2. **User clicks link** → Redirected to `VITE_APP_URL` with hash params containing tokens
3. **App detects hash** → Routes to `auth-callback` page
4. **AuthCallback component** → Extracts tokens, sets session, shows success message
5. **Auto-redirect** → User sent to dashboard after 2 seconds

### 4. Testing

**Development:**
```bash
# 1. Start dev server
npm run dev

# 2. Sign up with your email
# 3. Check email and click confirmation link
# 4. Should redirect to http://localhost:5173 and show "Email Verified!"
```

**Production:**
```bash
# 1. Deploy to Vercel with VITE_APP_URL set
# 2. Sign up with your email
# 3. Check email and click confirmation link
# 4. Should redirect to https://your-app.vercel.app and show "Email Verified!"
```

### 5. Troubleshooting

**Still getting localhost error?**
- Check Supabase Dashboard → Authentication → URL Configuration
- Make sure your production URL is in "Redirect URLs"
- Verify `VITE_APP_URL` is set in Vercel environment variables
- Redeploy after adding environment variables

**Email not arriving?**
- Check spam folder
- Verify email in Supabase Dashboard → Authentication → Users
- Check email template in Supabase Dashboard → Authentication → Email Templates

**Tokens not working?**
- Check browser console for errors
- Verify Supabase keys are correct in `.env`
- Check AuthCallback.tsx for error messages

## Quick Reference

| Environment | VITE_APP_URL | Supabase Site URL |
|-------------|--------------|-------------------|
| Local Dev   | http://localhost:5173 | http://localhost:5173 |
| Production  | https://your-app.vercel.app | https://your-app.vercel.app |

---

**Files Modified:**
- ✅ `frontend/src/app/components/AuthCallback.tsx` (created)
- ✅ `frontend/src/app/App.tsx` (added routing)
- ✅ `frontend/src/lib/supabase-helpers.ts` (added emailRedirectTo)
- ✅ `.env` (added VITE_APP_URL)
- ✅ `.env.example` (documented VITE_APP_URL)
