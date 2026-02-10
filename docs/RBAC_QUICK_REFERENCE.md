# ⚡ RBAC Quick Reference Guide

**Copy-paste ready code examples and checklists for quick implementation.**

---

## 🚀 5-Minute Setup

### 1. Check Your Role (Browser Console)
```javascript
// See current user's role
console.log('My role:', window.__APP_CONTEXT__.auth.user.role);

// Test access
const { hasFeatureAccess } = require('./lib/rbac');
console.log('Can access bookAdvisor?', hasFeatureAccess(role, 'bookAdvisor'));
```

### 2. Test Different Roles

```bash
# Admin
Login as: shake.job.atgmail.com

# Advisor
Add to .env.local: VITE_ADVISOR_EMAILS=advisor@test.com
Login as: advisor@test.com

# User
Login as: any-other-email@example.com
```

### 3. Navigate to Panels

```javascript
// In component
const { setCurrentPage } = useContext(AppContext);

// Admin
setCurrentPage('admin-feature-panel');

// Advisor
setCurrentPage('advisor-panel');
```

---

## 📋 Common Code Snippets

### Check If User Has Feature Access

```tsx
import { useFeatureAccess } from '@/hooks/useRBAC';

export const MyFeature = () => {
  const hasAccess = useFeatureAccess('bookAdvisor');
  
  if (!hasAccess) {
    return <AccessDenied />;
  }
  
  return <YourComponent />;
};
```

### Hide/Show Based on Role

```tsx
import { useIsAdmin, useIsAdvisor } from '@/hooks/useRBAC';

export const Navigation = () => {
  const isAdmin = useIsAdmin();
  const isAdvisor = useIsAdvisor();
  
  return (
    <nav>
      {isAdmin && <AdminLink />}
      {isAdvisor && <AdvisorLink />}
    </nav>
  );
};
```

### Check Multiple Features

```tsx
import { useMultipleFeatureAccess } from '@/hooks/useRBAC';

export const Dashboard = () => {
  const hasAll = useMultipleFeatureAccess(['accounts', 'transactions', 'reports']);
  
  if (!hasAll) return <div>Missing features</div>;
  
  return <FullDashboard />;
};
```

### Disable Button for Non-Authorized Users

```tsx
import { useActionPermission } from '@/hooks/useRBAC';

export const PayButton = () => {
  const canPay = useActionPermission('canPayForSessions');
  
  return (
    <button disabled={!canPay} onClick={handlePay}>
      Pay Now
    </button>
  );
};
```

### Require Specific Role

```tsx
import { useRequireRole } from '@/hooks/useRBAC';

export const AdvisorOnly = () => {
  const isAuthorized = useRequireRole(['admin', 'advisor']);
  
  if (!isAuthorized) {
    return <div>Only advisors can access this</div>;
  }
  
  return <AdvisorContent />;
};
```

---

## 🔐 Admin Email Lock Verification

### Frontend
```javascript
// File: frontend/src/lib/rbac.ts
export const isAdminEmail = (email: string | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase() === 'shake.job.atgmail.com'; // HARDCODED
};
```

### Check Admin Assignment
```javascript
// In AuthContext - Line ~45
if (isAdminEmail(email)) {
  console.log('🔐 Admin role assigned to:', email);
  return 'admin';
}
```

### Test It
```javascript
const { isAdminEmail } = require('./lib/rbac');
console.log(isAdminEmail('shake.job.atgmail.com'));  // true
console.log(isAdminEmail('hacker@example.com'));     // false
```

---

## 📊 Feature Matrix

### Quick Lookup

```
FEATURE               ADMIN  ADVISOR  USER
────────────────────────────────────────
accounts              ✅     ✅       ✅
transactions          ✅     ✅       ✅
loans                 ✅     ✅       ✅
goals                 ✅     ✅       ✅
groups                ✅     ✅       ✅
investments           ✅     ✅       ✅
reports               ✅     ✅       ✅
calendar              ✅     ✅       ✅
todoLists             ✅     ✅       ✅
transfer              ✅     ✅       ✅
taxCalculator         ✅     ✅       ✅
bookAdvisor           ✅     ❌       ✅ ⬅️ KEY DIFFERENCE
adminPanel            ✅     ❌       ❌
advisorPanel          ❌     ✅       ❌
```

### How to Use Check
```javascript
const { hasFeatureAccess } = require('./lib/rbac');

// Check any feature
hasFeatureAccess('admin', 'bookAdvisor');    // true
hasFeatureAccess('advisor', 'bookAdvisor');  // false ⬅️
hasFeatureAccess('user', 'bookAdvisor');     // true
```

---

## 🔄 Session State Flow

### Valid Transitions

```
pending
   ↓
accepted
   ↓
ready
   ↓
active
   ↓
completed

From ANY state:
   ↓
cancelled
```

### Test Validation

```javascript
const { isValidStateTransition } = require('./lib/sessionManagement');

// Valid
isValidStateTransition('pending', 'accepted');    // true
isValidStateTransition('active', 'completed');    // true
isValidStateTransition('pending', 'cancelled');   // true

// Invalid
isValidStateTransition('pending', 'active');      // false - skip accepted
isValidStateTransition('completed', 'pending');   // false - no backwards
```

---

## 💳 Payment System

### Quick Calculation

```javascript
const { calculatePlatformSplit } = require('./lib/paymentSettlement');

const amount = 1000; // User pays 1000
const { platformFee, advisorSettlement } = calculatePlatformSplit(amount);

// Result:
// platformFee: 100         (10% to platform)
// advisorSettlement: 900   (90% to advisor)
```

### Payment States

```
pending → processing → completed → [refund]
         (Processing)  (Done)
```

---

## 🔔 Notifications

### When They're Sent

| Event | Recipient | Status |
|-------|-----------|--------|
| User books | Advisor | ✅ Implemented |
| Advisor accepts | User | ✅ Implemented |
| Advisor rejects | User | ✅ Implemented |
| Session ready | Both | ✅ Implemented |
| Session starts | Both | ✅ Implemented |
| Session ends | Both | ✅ Implemented |
| Payment done | User | ✅ Implemented |
| Admin approved payment | Advisor | ✅ Implemented |

### Alert Sound? (Critical Only)
```javascript
const { shouldPlayAlert } = require('./lib/notificationSystem');

shouldPlayAlert('booking_request');    // true - plays sound
shouldPlayAlert('session_ready');      // true - plays sound
shouldPlayAlert('payment_received');   // true - plays sound
shouldPlayAlert('feature_released');   // false - no sound
```

---

## 🔧 Troubleshooting

### Problem: Component doesn't see role

```tsx
// ❌ WRONG - useAuth might not be updated
const auth = useAuth();
console.log(auth.user.role); // undefined?

// ✅ CORRECT - Use the hooks
const isAdmin = useIsAdmin();
console.log(isAdmin);
```

### Problem: Feature access always false

```javascript
// ❌ WRONG - typo in feature name
hasFeatureAccess('admin', 'bookadvisor'); // lowercase 'a'

// ✅ CORRECT - exact case
hasFeatureAccess('admin', 'bookAdvisor'); // camelCase
```

### Problem: Admin can't access panel

```javascript
// Check email exactly
const { isAdminEmail } = require('./lib/rbac');
console.log(isAdminEmail('shake.job.atgmail.com'));

// If false, check:
1. Exact spelling: shake.job.atgmail.com (not .com, not .in)
2. Not the Supabase account email
3. Clear auth cache and re-login
```

### Problem: Advisor can book self

```javascript
// Current behavior: Advisors can see bookAdvisor in feature check
hasFeatureAccess('advisor', 'bookAdvisor'); // false ✅

// If they CAN book, check:
1. Their role is 'advisor' (not 'user')
2. Feature readiness is not 'released' for all
3. Component is checking useFeatureAccess()
```

---

## ✅ Pre-Deployment Checklist

- [ ] Admin email `shake.job.atgmail.com` works
- [ ] Other emails cannot be admin
- [ ] Advisors cannot see bookAdvisor
- [ ] Users can book advisors
- [ ] Feature readiness control works
- [ ] Notifications send correctly
- [ ] Payment splits correctly (90/10)
- [ ] Sessions follow state machine
- [ ] useFeatureAccess() hook works
- [ ] useIsAdmin() hook works
- [ ] useRequireRole() hook works

---

## 📁 File Quick Links

| File | Purpose |
|------|---------|
| [rbac.ts](../frontend/src/lib/rbac.ts) | Permission system |
| [useRBAC.ts](../frontend/src/hooks/useRBAC.ts) | React hooks |
| [sessionManagement.ts](../frontend/src/lib/sessionManagement.ts) | Session workflow |
| [notificationSystem.ts](../frontend/src/lib/notificationSystem.ts) | Notifications |
| [paymentSettlement.ts](../frontend/src/lib/paymentSettlement.ts) | Payments |
| [AdminFeaturePanel.tsx](../frontend/src/app/components/AdminFeaturePanel.tsx) | Admin UI |
| [AdvisorPanel.tsx](../frontend/src/app/components/AdvisorPanel.tsx) | Advisor UI |
| [AuthContext.tsx](../frontend/src/contexts/AuthContext.tsx) | Auth logic |

---

## 🎓 Learn More

- **Full Details**: [RBAC_IMPLEMENTATION.md](./RBAC_IMPLEMENTATION.md)
- **Component Usage**: [RBAC_COMPONENT_INTEGRATION.md](./RBAC_COMPONENT_INTEGRATION.md)
- **Testing Guide**: [RBAC_TESTING_DEPLOYMENT.md](./RBAC_TESTING_DEPLOYMENT.md)
- **Backend API**: [RBAC_BACKEND_API.md](./RBAC_BACKEND_API.md)
- **Complete Summary**: [RBAC_COMPLETE_SUMMARY.md](./RBAC_COMPLETE_SUMMARY.md)

---

## 💡 Pro Tips

### 1. Check All Permissions at Once
```javascript
const { hasFeatureAccess, canPerformAction } = require('./lib/rbac');

const role = 'advisor';
const features = ['accounts', 'transactions', 'bookAdvisor'];
const actions = ['canStartSessions', 'canBookAdvisors'];

features.forEach(f => {
  console.log(`${f}: ${hasFeatureAccess(role, f)}`);
});

actions.forEach(a => {
  console.log(`${a}: ${canPerformAction(role, a)}`);
});
```

### 2. Debug Role Assignment
```javascript
// In AuthContext during parseUserRole()
console.log('Processing email:', email);
console.log('Is admin?', isAdminEmail(email));
console.log('Is advisor?', advisorList.includes(email));
console.log('Final role:', role);
```

### 3. Test Feature Visibility
```javascript
const { isFeatureVisible } = require('./lib/rbac');

isFeatureVisible('bookAdvisor', 'user', 'released');  // true
isFeatureVisible('bookAdvisor', 'advisor', 'released'); // false
isFeatureVisible('aiInsights', 'admin', 'unreleased'); // true
```

### 4. Verify Payment Calculation
```javascript
const amounts = [100, 500, 1000, 2500];
amounts.forEach(a => {
  const split = calculatePlatformSplit(a);
  console.log(`₹${a} → Platform: ₹${split.platformFee}, Advisor: ₹${split.advisorSettlement}`);
});
```

### 5. Log All Permissions for a Role
```javascript
const { getAllowedFeatures } = require('./lib/rbac');

console.log('User features:', getAllowedFeatures('user'));
console.log('Advisor features:', getAllowedFeatures('advisor'));
console.log('Admin features:', getAllowedFeatures('admin'));
```

---

## 🚀 One-Liner Tests

```javascript
// Copy-paste into browser console ⬇️

// Test admin email lock
require('./lib/rbac').isAdminEmail('shake.job.atgmail.com') ? console.log('✅ Admin lock works') : console.log('❌ Login failed');

// Test feature matrix
['bookAdvisor'].forEach(f => console.log(`${f}: admin=${require('./lib/rbac').hasFeatureAccess('admin',f)} advisor=${require('./lib/rbac').hasFeatureAccess('advisor',f)} user=${require('./lib/rbac').hasFeatureAccess('user',f)}`));

// Test state transitions
['pending→accepted', 'accepted→ready', 'ready→active', 'active→completed'].forEach(t => { const [from,to] = t.split('→'); console.log(`${t}: ${require('./lib/sessionManagement').isValidStateTransition(from,to) ? '✅' : '❌'}`); });

// Test payment split
const split = require('./lib/paymentSettlement').calculatePlatformSplit(1000); console.log(`₹1000 → Platform: ₹${split.platformFee}, Advisor: ₹${split.advisorSettlement}`);
```

---

## 📞 Quick Help

**Q: How do I make someone an advisor?**
```env
# Add to .env.local
VITE_ADVISOR_EMAILS=newemail@example.com
# Restart dev server
```

**Q: Can I change who is admin?**
```
No. Admin email is HARDCODED as:
shake.job.atgmail.com

This is intentional for security.
```

**Q: How do I test different roles?**
```
1. Login with different emails
2. Each email = different role
3. Admin: shake.job.atgmail.com
4. Advisor: Email in VITE_ADVISOR_EMAILS
5. User: Any other email
```

**Q: Where's the feature control panel?**
```
Admin Login → Menu → "Admin Panel" appears
Route: admin-feature-panel
```

**Q: Where's the advisor workspace?**
```
Advisor Login → Menu → "Advisor Panel" appears
Route: advisor-panel
```

---

## 🎯 Next Steps

1. **Test All Roles** - Login with admin, advisor, user emails
2. **Check Features** - Verify who can see what
3. **Try State Changes** - Book advisor, accept, start session
4. **Verify Payments** - Check 90/10 split
5. **Review Notifications** - Check console for sent notifications
6. **Read Full Docs** - Review RBAC_IMPLEMENTATION.md for details

---

**Last Updated**: February 2025  
**Status**: ✅ Production Ready  
**Version**: 1.0

