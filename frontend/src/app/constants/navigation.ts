import {
  LayoutDashboard,
  Wallet,
  Receipt,
  CreditCard,
  Target,
  Users,
  TrendingUp,
  BarChart3,
  Settings,
  Calendar,
  Bell,
  User,
  CheckSquare,
  BookOpen,
} from 'lucide-react';

export type UserRole = 'admin' | 'advisor' | 'user';

export interface NavigationItem {
  id: string;
  label: string;
  icon: any;
  feature: string; // RBAC feature name to check
  roles?: UserRole[]; // If undefined, accessible by all. If defined, only these roles can see it
}

export const headerMenuItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
  { id: 'accounts', label: 'Accounts', icon: Wallet, feature: 'accounts' },
  { id: 'transactions', label: 'Transactions', icon: Receipt, feature: 'transactions' },
  { id: 'loans', label: 'Loans & EMIs', icon: CreditCard, feature: 'loans' },
  { id: 'goals', label: 'Goals', icon: Target, feature: 'goals' },
  { id: 'groups', label: 'Group Expenses', icon: Users, feature: 'groups' },
  { id: 'investments', label: 'Investments', icon: TrendingUp, feature: 'investments' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, feature: 'calendar' },
  { id: 'reports', label: 'Reports', icon: BarChart3, feature: 'reports' },
  { id: 'todo-lists', label: 'Todo Lists', icon: CheckSquare, feature: 'todoLists' },
  { id: 'book-advisor', label: 'Book Advisor', icon: BookOpen, feature: 'bookAdvisor' },
  { id: 'notifications', label: 'Notifications', icon: Bell, feature: 'notifications' },
  { id: 'user-profile', label: 'Profile', icon: User, feature: 'userProfile' },
  { id: 'settings', label: 'Settings', icon: Settings, feature: 'settings' },
  // Admin-only items
  { id: 'admin-feature-panel', label: 'Admin Panel', icon: BarChart3, feature: 'adminPanel', roles: ['admin'] },
];

export const sidebarMenuItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
  { id: 'accounts', label: 'Accounts', icon: Wallet, feature: 'accounts' },
  { id: 'transactions', label: 'Transactions', icon: Receipt, feature: 'transactions' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, feature: 'calendar' },
  { id: 'investments', label: 'Investments', icon: TrendingUp, feature: 'investments' },
  { id: 'loans', label: 'Loans', icon: CreditCard, feature: 'loans' },
  { id: 'goals', label: 'Goals', icon: Target, feature: 'goals' },
  { id: 'reports', label: 'Reports', icon: BarChart3, feature: 'reports' },
  { id: 'todo-lists', label: 'Todo Lists', icon: CheckSquare, feature: 'todoLists' },
  { id: 'book-advisor', label: 'Book Advisor', icon: BookOpen, feature: 'bookAdvisor' },
  { id: 'settings', label: 'Settings', icon: Settings, feature: 'settings' },
  // Admin-only items
  { id: 'admin-feature-panel', label: 'Admin Panel', icon: BarChart3, feature: 'adminPanel', roles: ['admin'] },
  // Advisor-only items
  { id: 'advisor-panel', label: 'Advisor Panel', icon: Users, feature: 'advisorPanel', roles: ['advisor'] },
];
