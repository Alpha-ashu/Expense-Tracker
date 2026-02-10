# Admin Feature Flag Control Panel

## ✅ What Was Built

A safe, admin-only feature flag system that lets you test features before rolling them out to advisors and regular users.

### Files Created:
1. **[useFeatureFlags hook](frontend/src/hooks/useFeatureFlags.ts)** - Feature flag state management
2. **[AdminDashboard component](frontend/src/app/components/AdminDashboard.tsx)** - Admin UI for toggling flags
3. **Updated [App.tsx](frontend/src/app/App.tsx)** - Routes to admin panel
4. **Updated [Sidebar.tsx](frontend/src/app/components/Sidebar.tsx)** - Admin-only menu item
5. **Updated [AppContext.tsx](frontend/src/contexts/AppContext.tsx)** - Reads admin flag overrides

## 🎯 How It Works

### User Flow:
1. **Login as Admin** (email: `shaik.job.details@gmail.com`)
2. **Click "Admin"** in sidebar (yellow lightning icon)
3. **Toggle features On/Off for each role:**
   - Admin (you)
   - Advisor
   - User
4. **Changes apply instantly** across the app
5. **Storage:** Feature flags saved to browser's localStorage

### Example Use Case:
```
User toggles:
✓ financeAdvisor ON for admin
✗ financeAdvisor OFF for advisor
✗ financeAdvisor OFF for user

Result:
- Only ADMIN can see "Finance Advisor" menu item & page
- Advisors and Users get the feature when you toggle it ON for them
- NO code changes needed
```

## 🚀 Control Flow

```
Admin toggles icon in AdminDashboard
  ↓
Feature flag saved to localStorage[featureFlagsOverride]
  ↓
AppContext detects change (window.storage event)
  ↓
Re-computes visibleFeatures for current role
  ↓
Sidebar, menu items, pages auto-update
  ↓
Other logged-in users see their flags immediately
```

## 🧪 Testing Workflow

### Test a new feature before releasing:

**Step 1: Admin enables for self only**
- Turn feature ON for admin
- Turn feature OFF for advisor & user
- Test the feature in your admin account

**Step 2: Debug & iterate**
- Fix bugs
- Adjust UX
- No other users affected

**Step 3: Rolling release**
- Turn feature ON for advisor → test
- Turn feature ON for user → go live

**Step 4: Reset anytime**
- Button to reset all to defaults
- Revert unwanted changes instantly

## 📋 Current Feature Flags

| Feature | Admin | Advisor | User | Description |
|---------|:-----:|:-------:|:----:|-------------|
| accounts | ✅ | ❌ | ✅ | Bank accounts & cards |
| transactions | ✅ | ❌ | ✅ | Expense tracking |
| loans | ✅ | ❌ | ✅ | Loans & EMIs |
| goals | ✅ | ❌ | ✅ | Savings goals |
| groups | ✅ | ❌ | ✅ | Shared expenses |
| investments | ✅ | ❌ | ✅ | Investment portfolio |
| reports | ✅ | ✅ | ✅ | Analytics |
| calendar | ✅ | ✅ | ✅ | Calendar view |
| todoLists | ✅ | ❌ | ✅ | To-do lists |
| transfer | ✅ | ❌ | ✅ | Money transfers |
| taxCalculator | ✅ | ❌ | ✅ | Tax tools |
| financeAdvisor | ✅ | ✅ | ✅ | Advisor booking |

## 🔐 Security Notes

- Admin panel blocks non-admin users (403 error)
- Feature flags stored in **browser localStorage** (dev/test only)
- **Not production-ready** for multi-user deployments
- For production → integrate with backend feature flag service (LaunchDarkly, CloudFlare, etc.)

## 🛠️ For Production:

When ready to deploy, replace localStorage with:
1. **Server-side flag service** (API endpoint)
2. **Flag evaluation on backend** (authoritative)
3. **Cache via Redis** (performance)
4. **Admin UI makes API calls** (persist to DB)

## 📝 Next Steps:

✅ **Done:** Feature flag system + admin UI ✅ **Next (if needed):**
- [ ] Advisor workspace (assigned users list, chat)
- [ ] Secure PIN system (first-time login)
- [ ] Backend RBAC policies (Supabase RLS)
- [ ] Production-grade flag service integration

## 🎓 How to Test Right Now:

**Open browser DevTools**:
```javascript
// See all feature flags
JSON.parse(localStorage.getItem('featureFlagsOverride'))

// Manually toggle (same as UI)
const flags = JSON.parse(localStorage.getItem('featureFlagsOverride'));
flags.financeAdvisor.user = true;
localStorage.setItem('featureFlagsOverride', JSON.stringify(flags));
```

**Restart dev server** if env vars change.

---

**Questions?** The Admin panel includes a blue info box with how it works.
