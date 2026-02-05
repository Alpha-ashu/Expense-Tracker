import React, { useState } from 'react';
import { Bell, Search, Menu, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { Sheet, SheetContent, SheetTrigger } from '@/app/components/ui/sheet';
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
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'loans', label: 'Loans & EMIs', icon: CreditCard },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'groups', label: 'Group Expenses', icon: Users },
  { id: 'investments', label: 'Investments', icon: TrendingUp },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Header: React.FC = () => {
  const { totalBalance, currency, currentPage, setCurrentPage } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const unreadNotifications = useLiveQuery(
    () => db.notifications.filter(n => !n.isRead).count(),
    []
  ) || 0;

  const notifications = useLiveQuery(
    () => db.notifications.toCollection().reverse().limit(10).toArray(),
    []
  ) || [];

  const handleMarkAsRead = async (notificationId: string) => {
    await db.notifications.update(notificationId, { isRead: true });
  };

  const handleClearAll = async () => {
    await db.notifications.clear();
    setNotificationsOpen(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleMenuItemClick = (itemId: string) => {
    setCurrentPage(itemId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      {/* Mobile Menu Button */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Menu size={24} className="text-gray-700" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <div className="flex flex-col h-full bg-white">
            <div className="p-6 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-blue-600">FinanceLife</h1>
              <p className="text-sm text-gray-500 mt-1">Your Financial OS</p>
            </div>
            
            <nav className="flex-1 p-4 overflow-y-auto scrollbar-hide">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuItemClick(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-200">
              <div className="bg-blue-600 p-4 rounded-lg text-white">
                <p className="text-sm font-medium">Privacy First</p>
                <p className="text-xs mt-1">Your data stays on your device</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search transactions, accounts..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-sm text-gray-500">Total Balance</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalBalance)}</p>
        </div>

        <div className="relative">
          <button 
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell size={20} className="text-gray-600" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={18} className="text-gray-600" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notification.isRead ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notification.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-200">
                  <button
                    onClick={handleClearAll}
                    className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};