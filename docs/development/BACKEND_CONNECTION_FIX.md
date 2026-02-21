# Backend Connection Error - Quick Fix

## 🚨 Main Issue Identified

**Error**: `POST http://localhost:5000/api/v1/accounts net::ERR_CONNECTION_REFUSED`

**Problem**: Your backend server is **not running** on port 5000.

## ✅ Quick Solution

### Step 1: Start Backend Server
```bash
# Open new terminal and run:
cd "k:\Project\Anitgravity\Expense Tracker\backend"
npm run dev
```

### Step 2: Verify Backend is Running
After starting, you should see:
```bash
# Expected output:
Server running on port 5000
API documentation available at http://localhost:5000/docs
Database connected successfully
```

### Step 3: Test Backend Connection
```bash
# Test if backend is accessible:
curl http://localhost:5000/api/v1/health

# Expected response:
{"status": "ok", "timestamp": "..."}
```

## 🛠️ Troubleshooting

### If Backend Won't Start

#### **Port Already in Use**
```bash
# Check what's using port 5000:
netstat -an | grep :5000

# Kill process using port:
npx kill-port 5000

# Or use different port:
PORT=5001 npm run dev
```

#### **Database Connection Issues**
```bash
# Check database connection:
cd "k:\Project\Anitgravity\Expense Tracker\backend"
npx prisma db push

# Reset database if needed:
npx prisma db reset --force
npx prisma db push
```

#### **Environment Variables**
```bash
# Check .env file:
cd "k:\Project\Anitgravity\Expense Tracker\backend"
cat .env

# Should contain:
DATABASE_URL="file:./dev.db"
NODE_ENV="development"
PORT=5000
```

#### **Dependencies Issues**
```bash
# Install missing dependencies:
npm install

# Clear and reinstall:
rm -rf node_modules package-lock.json
npm install
```

## 🔄 Development Workflow

### **Correct Terminal Setup**

**Terminal 1 (Backend)**:
```bash
cd "k:\Project\Anitgravity\Expense Tracker\backend"
npm run dev
```

**Terminal 2 (Frontend)**:
```bash
cd "k:\Project\Anitgravity\Expense Tracker\frontend"
npm run dev
```

### **Expected Console Output**
After backend is running, you should see:
```bash
✅ Permissions fetched successfully
✅ Account created successfully
✅ Data saved to backend
```

### **No More Console Errors**
- ❌ `net::ERR_CONNECTION_REFUSED` → ✅ Successful API calls
- ❌ `Failed to save account` → ✅ Account creation works
- ❌ `Network Error` → ✅ Smooth data synchronization

## 🎯 **Verification Steps**

### 1. Check Backend Status
```bash
# Test health endpoint:
curl http://localhost:5000/api/v1/health
```

### 2. Test API Endpoints
```bash
# Test accounts endpoint:
curl -X POST http://localhost:5000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Account","type":"bank","balance":1000}'
```

### 3. Check Frontend Connection
Open browser and navigate to:
- `http://localhost:5173`
- Try to add an account
- Check console for successful API calls

## 🚀 **Common Issues & Solutions**

### **Issue**: Port 5000 already in use
**Solution**: Kill existing process or use different port
```bash
# Kill existing process:
npx kill-port 5000

# Use different port:
PORT=5001 npm run dev
```

### **Issue**: Database connection failed
**Solution**: Check database file and permissions
```bash
# Check database file:
ls -la prisma/dev.db

# Reset database:
npx prisma db reset --force
npx prisma db push
```

### **Issue**: Module not found errors
**Solution**: Install missing dependencies
```bash
npm install
```

### **Issue**: Environment variables missing
**Solution**: Check .env configuration
```bash
# Copy example file:
cp .env.example .env

# Edit with correct values:
notepad .env
```

## 📋 **Backend Package Scripts**

Check your `backend/package.json` has these scripts:
```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:push": "prisma db push",
    "db:reset": "prisma db reset --force"
  }
}
```

## 🎉 **Expected Result**

After starting the backend:

✅ **Backend running** on http://localhost:5000  
✅ **API endpoints accessible** - All routes work  
✅ **Database connected** - Data persistence works  
✅ **No connection errors** - Smooth frontend-backend communication  
✅ **Full functionality** - Account creation, data sync, etc.  

**Your app will be fully functional once the backend is running!** 🚀

## 📱 **Quick Test**

1. Start backend: `npm run dev` in backend folder
2. Start frontend: `npm run dev` in frontend folder  
3. Open browser: `http://localhost:5173`
4. Try adding an account
5. Check console: Should show success messages

**If you still see `net::ERR_CONNECTION_REFUSED`, the backend is not running properly!**
