import React, { useState } from 'react';
import { Bell, Search, Menu, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useRBAC';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { headerMenuItems } from '@/app/constants/navigation';

export const Header: React.FC = () => {
  const { totalBalance, currency, currentPage, setCurrentPage } = useApp();
  const { role } = useAuth();
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

  // Filter menu items based on RBAC
  const visibleMenuItems = headerMenuItems.filter(item => {
    // If item has role restrictions, only show if user has that role
    if (item.roles && item.roles.length > 0) {
      return item.roles.includes(role);
    }
    // Otherwise check feature access
    return true;
  });

  const handleMarkAsRead = async (notification: any) => {
    // Mark as read
    await db.notifications.update(notification.id, { isRead: true });

    // Navigate if deepLink exists
    if (notification.deepLink) {
      // Parse deepLink like "/calendar?session=123" or "/advisor-workspace"
      const [path, query] = notification.deepLink.split('?');
      setCurrentPage(path.replace('/', ''));

      // If there are query params, store them for the component
      if (query) {
        const params = new URLSearchParams(query);
        params.forEach((value, key) => {
          localStorage.setItem(`deepLink_${key}`, value);
        });
      }
    }

    setNotificationsOpen(false);
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
    <div className="h-16 bg-bg-card/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-3 sm:px-4 lg:px-6 sticky top-0 z-40">
      {/* Mobile Menu Button */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild>
          <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Menu size={24} className="text-text-primary" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 bg-bg-card border-r border-white/10 text-text-primary">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu with links to all app sections</SheetDescription>
          <div className="flex flex-col h-full bg-bg-card">
            <div className="p-6 border-b border-white/10">
              <h1 className="text-2xl font-bold text-accent-secondary font-display">FinanceLife</h1>
              <p className="text-sm text-text-secondary mt-1">Your Financial OS</p>
            </div>

            <nav className="flex-1 p-4 overflow-y-auto scrollbar-hide">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleMenuItemClick(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${isActive
                      ? 'bg-accent-secondary/10 text-accent-secondary'
                      : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                      }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10">
              <div className="bg-accent-secondary/20 border border-accent-secondary/30 p-4 rounded-xl text-text-primary">
                <p className="text-sm font-bold font-display">Privacy First</p>
                <p className="text-xs mt-1 text-text-secondary">Your data stays on your device</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={20} />
          <input
            type="text"
            placeholder="Search transactions, accounts..."
            className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-secondary text-text-primary placeholder-text-muted transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-text-muted uppercase tracking-wider font-bold">Total Balance</p>
          <p className="text-xl font-bold text-text-primary font-display">{formatCurrency(totalBalance)}</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <Bell size={20} className="text-text-secondary" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-bg-secondary border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden ring-1 ring-white/5">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-bg-tertiary/50 backdrop-blur-sm">
                <h3 className="font-bold text-text-primary font-display">Notifications</h3>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={18} className="text-text-secondary" />
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
                        className={`p-4 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0 ${!notification.isRead ? 'bg-accent-secondary/5' : ''
                          }`}
                        onClick={() => handleMarkAsRead(notification)}
                      >
                        <div className="flex items-start gap-3">
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-accent-secondary rounded-full mt-2 flex-shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary line-clamp-2">
                              {notification.title}
                            </p>
                            <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-wider">
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
                <div className="p-3 border-t border-white/10 bg-bg-tertiary/30">
                  <button
                    onClick={handleClearAll}
                    className="w-full py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors font-medium"
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