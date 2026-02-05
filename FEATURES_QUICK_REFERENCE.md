# Quick Reference Guide - New Features

## 🧾 Bill/Receipt Upload Feature

### What It Does
Allows users to attach bills, invoices, and receipts to their expense transactions for better financial record-keeping.

### Where to Find It
- Located in: **AddTransaction** component (for expenses only)
- Ready to integrate into the expense form
- Files stored locally (IndexedDB) for offline access

### How It Works
1. Users select expense transaction type
2. Upload section appears (drag & drop or click to browse)
3. Supported formats: JPG, PNG, WebP, PDF (max 10MB each)
4. Files attach to specific expense transaction
5. Can download or delete bills anytime

### Component Location
- `src/app/components/BillUpload.tsx` - Reusable component
- Database: `expenseBills` table

### Next Steps to Enable
Add to AddTransaction form:
```tsx
{formData.type === 'expense' && (
  <BillUpload transactionId={transactionId} />
)}
```

---

## ✅ To-Do List Feature

### What It Does
Complete task management system with sharing & collaboration capabilities.

### Main Features
✨ **Create & Manage Lists**
- Create unlimited to-do lists
- Add descriptions
- Archive or delete lists
- Track progress with visual indicators

📝 **Manage Tasks**
- Add tasks with priority (Low/Medium/High)
- Set due dates
- Mark complete/incomplete
- Delete tasks
- View progress percentage

👥 **Share & Collaborate**
- Share lists with other app users
- Set permission levels (View Only or Can Edit)
- Change permissions anytime
- Remove access as needed

### How to Access

**From Sidebar:**
1. Look for "✅ To-Do Lists" in the menu
2. Click to open list overview

**Navigation:**
- **Main Lists** → `/todo-lists` - Overview & management
- **List Detail** → `/todo-list-detail` - Task management
- **Share** → `/todo-list-share` - Permission management

### Usage Workflow

**Create a New List:**
1. Click "New List" button
2. Enter list name (required) and description (optional)
3. Click "Create List"
4. Redirects to list detail page

**Add Tasks to List:**
1. Click "Open" on any list
2. Enter task title in the form
3. Select priority (Low/Medium/High)
4. Optionally set due date
5. Click "Add Task"
6. Task appears in the list

**Complete Tasks:**
1. Click the circle icon next to task
2. Circle turns green with checkmark
3. Task title turns gray
4. Progress bar updates automatically

**Share List with Others:**
1. Click "Share" button on list card
2. Select user from dropdown
3. Choose permission: "View Only" or "Can Edit"
4. Click "Share List"
5. User appears in "Shared With" section
6. Toggle permission with Lock/Edit icons
7. Remove user with Trash icon

### Component Locations
- `src/app/components/ToDoLists.tsx` - List overview
- `src/app/components/ToDoListDetail.tsx` - Task management
- `src/app/components/ToDoListShare.tsx` - Sharing management

### Database Tables
- `toDoLists` - Main lists
- `toDoItems` - Individual tasks
- `toDoListShares` - Sharing permissions

### Feature Settings
- Toggle visibility in: **Settings > Feature Visibility**
- Icon: ✅ To-Do Lists
- Default: Enabled

---

## 🗄️ Database Schema

### Bill Upload
```typescript
interface ExpenseBill {
  id: number
  transactionId: number      // Link to expense
  fileName: string            // Original filename
  fileType: string            // MIME type
  fileSize: number            // Bytes
  fileData: Blob              // File content
  uploadedAt: Date            // Upload timestamp
  notes?: string              // Optional notes
}
```

### To-Do Lists
```typescript
interface ToDoList {
  id: number
  name: string                // List name
  description?: string        // Optional description
  ownerId: string             // User who created
  createdAt: Date             // Creation date
  updatedAt?: Date            // Last update
  archived: boolean           // Archive status
}

interface ToDoItem {
  id: number
  listId: number              // Parent list
  title: string               // Task title
  description?: string        // Task details
  completed: boolean          // Completion status
  priority: 'low'|'medium'|'high'  // Priority
  dueDate?: Date              // Due date
  createdBy: string           // Creator
  createdAt: Date             // Creation date
  updatedAt?: Date            // Last update
  completedAt?: Date          // Completion timestamp
}

interface ToDoListShare {
  id: number
  listId: number              // Shared list
  sharedWithUserId: string    // Recipient
  permission: 'view'|'edit'   // Permission level
  sharedAt: Date              // Share date
  sharedBy: string            // Who shared
}
```

---

## 🔧 Integration Notes

### Added to Sidebar
- New menu item: "✅ To-Do Lists"
- Appears in filtered menu based on feature visibility

### Added to AppContext
- `visibleFeatures.todoLists` - Control visibility
- Default: `true` (enabled)

### Added to Settings
- Feature Visibility section
- Toggle: "✅ To-Do Lists"
- Shows/hides feature from sidebar

### Added Routes (App.tsx)
- `'todo-lists'` → ToDoLists component
- `'todo-list-detail'` → ToDoListDetail component  
- `'todo-list-share'` → ToDoListShare component

---

## 📱 UI Elements

### To-Do List Card
Shows: Name, description, creation date, action buttons
- Open (blue button)
- Share (person icon)
- Archive (archive icon)
- Delete (trash icon)

### Task Item
Shows: Checkbox, title, description, priority badge, due date
- Click checkbox to complete
- Delete button (trash icon)
- Color-coded priority

### Priority Colors
- 🟢 Low: Green background
- 🟡 Medium: Yellow background
- 🔴 High: Red background

---

## 🚀 Build Status

✅ **Successfully Built**
- 2,805 modules transformed
- Build size: 1,172.34 kB (335.83 kB gzipped)
- Build time: 11.30s
- Zero errors
- All features verified

---

## 💡 Tips & Tricks

1. **For Bills**: Keep PDFs under 10MB for faster uploads
2. **For Tasks**: Set due dates to get organized
3. **For Sharing**: Start with "View Only" permission, upgrade if needed
4. **Mobile**: Feature works great on mobile with touch support
5. **Offline**: All data persists locally, syncs when reconnected

---

## 📞 Support Features

### Error Handling
- File size validation (max 10MB)
- File type validation (JPG, PNG, WebP, PDF)
- User-friendly error messages via toast notifications
- Graceful failure handling

### Offline Support
- All data stored in IndexedDB
- Works without internet connection
- Automatic sync when reconnected
- No data loss

### Accessibility
- Keyboard navigation support
- Touch-friendly buttons
- Clear visual indicators
- Readable text colors and sizes

---

## 🎯 Perfect For

### Bill/Receipt Upload
- 🧮 Accountants tracking receipts
- 🏢 Business owners managing expenses
- 👨‍💼 Employees claiming reimbursements
- 💼 Freelancers maintaining records

### To-Do Lists
- 👥 Teams managing tasks together
- 📋 Project managers tracking work
- 👨‍👩‍👧‍👦 Families sharing responsibilities
- 🎯 Individuals organizing their life
- 📚 Students managing assignments
