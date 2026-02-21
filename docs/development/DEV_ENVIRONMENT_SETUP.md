# Development Environment Setup Guide

## 🛠️ Current Issues Identified

From your console logs, I see several problems:

### 1. **Backend Connection Issues**
```
POST http://localhost:5000/api/v1/accounts net::ERR_CONNECTION_REFUSED
```
**Problem**: Backend server is not running on port 5000

### 2. **Network/CORS Issues**
```
Access to fetch at 'https://mmwrckfqeqjfqciymemh.supabase.co/functions/v1/get-user-permissions' from origin 'http://localhost:5173' has been blocked by CORS policy
```
**Problem**: CORS configuration issues with Supabase functions

### 3. **React DevTools Not Available**
**Problem**: Missing React DevTools for better debugging experience

## 🚀 Quick Fixes

### Fix 1: Start Backend Server
```bash
cd "k:\Project\Anitgravity\Expense Tracker\backend"
npm run dev
```

### Fix 2: Install React DevTools
```bash
cd "k:\Project\Anitgravity\Expense Tracker\frontend"
npm install --save-dev @types/react-devtools
```

Then add to your main.tsx:
```typescript
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// Add React DevTools
if (import.meta.env.DEV) {
  import('@react-devtools-extension').then((devTools) => {
    devTools.connectToReactApp(createRoot(document.getElementById("root")!.render(<App />)));
  }).catch((error) => {
    console.log('React DevTools not available:', error);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
```

### Fix 3: Check Backend Configuration
Ensure your backend is configured to run on port 5000:
- Check `.env` file in backend
- Check `package.json` scripts
- Verify no other service is using port 5000

### Fix 4: CORS Issues (if using Supabase)
Update your Supabase CORS configuration in the dashboard:
1. Go to Supabase Dashboard → Settings → API
2. Add `http://localhost:5173` to allowed origins
3. Save and redeploy functions

## 🔧 Development Workflow

### 1. Start Backend First
```bash
# Terminal 1 - Backend
cd "k:\Project\Anitgravity\Expense Tracker\backend"
npm run dev

# Terminal 2 - Frontend  
cd "k:\Project\Anitgravity\Expense Tracker\frontend"
npm run dev
```

### 2. Verify Services Running
- Backend: http://localhost:5000 should show API documentation
- Frontend: http://localhost:5173 should show your app
- Check both terminals for any errors

### 3. Test Auto-Sizing
- Navigate to: `http://localhost:5173/#auto-sizing-test`
- Open React DevTools to inspect components
- Resize browser to test responsive behavior

## 🐛 Common Issues & Solutions

### Backend Won't Start
```bash
# Check if port is in use
netstat -an | grep :5000

# Kill process using port
npx kill-port 5000

# Or use different port
PORT=5001 npm run dev
```

### CORS Errors
```javascript
// Temporary fix for development - add to frontend vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

### Module Resolution Issues
```bash
# Clear node modules
rm -rf node_modules package-lock.json
npm install

# Clear vite cache
npm run build -- --mode development
```

## 📱 Recommended VS Code Extensions

### Essential Extensions:
1. **React Developer Tools** - msjsdiag.debugger-for-react
2. **ES7+ Snippets** - dbaeumer.vscode-eslint
3. **Prettier** - esbenp.prettier-vscode
4. **Auto Rename Tag** - usernamehwu.vscode-autorenametag
5. **GitLens** - eamodio.gitlens

### Configuration:
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## 🎯 Next Steps

1. **Fix backend connection** - Start backend server on port 5000
2. **Install React DevTools** - Better debugging experience
3. **Test auto-sizing** - Verify responsive behavior works
4. **Fix CORS issues** - Update Supabase configuration if needed
5. **Use proper workflow** - Backend + frontend running simultaneously

## 🚀 Ready to Develop

Once these fixes are applied, you'll have:
- ✅ Backend API running on localhost:5000
- ✅ Frontend running on localhost:5173  
- ✅ React DevTools for debugging
- ✅ Auto-sizing system ready for testing
- ✅ Proper development workflow

Your development environment will be fully set up for productive work! 🎉
