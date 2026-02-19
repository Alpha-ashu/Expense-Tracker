import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Bell, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, RotateCcw, Gift, Users, Target, Zap, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
  id: string;
  type: 'transaction' | 'emi' | 'reminder' | 'investment' | 'goal' | 'achievement';
  title: string;
  description: string;
  amount?: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

export const Notifications: React.FC = () => {
  const { setCurrentPage, currency } = useApp();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'transaction',
      title: 'Transaction Recorded',
      description: 'Your expense of ₹500 for groceries has been recorded.',
      amount: 500,
      icon: <TrendingDown className="w-5 h-5" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200',
      timestamp: new Date(Date.now() - 15 * 60000),
      read: false,
      action: { label: 'View', handler: () => setCurrentPage('transactions') },
    },
    {
      id: '2',
      type: 'emi',
      title: 'EMI Due Reminder',
      description: 'Your monthly EMI of ₹2,500 is due on Feb 10. Pay now to avoid penalties.',
      amount: 2500,
      icon: <AlertCircle className="w-5 h-5" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 border-orange-200',
      timestamp: new Date(Date.now() - 2 * 3600000),
      read: false,
      action: { label: 'Pay Now', handler: () => setCurrentPage('pay-emi') },
    },
    {
      id: '3',
      type: 'investment',
      title: 'Investment Update',
      description: 'Your mutual fund SIP of ₹5,000 has been invested successfully.',
      amount: 5000,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200',
      timestamp: new Date(Date.now() - 8 * 3600000),
      read: true,
    },
    {
      id: '4',
      type: 'goal',
      title: 'Goal Progress',
      description: 'You\'ve saved 35% towards your Vacation goal. Keep going!',
      icon: <Target className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
      timestamp: new Date(Date.now() - 24 * 3600000),
      read: true,
      action: { label: 'View Goal', handler: () => setCurrentPage('goals') },
    },
    {
      id: '5',
      type: 'reminder',
      title: 'Task Reminder',
      description: 'Review your expenses for the week and plan budget for next week.',
      icon: <Zap className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 border-purple-200',
      timestamp: new Date(Date.now() - 48 * 3600000),
      read: false,
    },
    {
      id: '6',
      type: 'achievement',
      title: 'Achievement Unlocked',
      description: 'You\'ve reached a milestone! 30 consecutive days of expense tracking.',
      icon: <Gift className="w-5 h-5" />,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 border-yellow-200',
      timestamp: new Date(Date.now() - 72 * 3600000),
      read: true,
    },
    {
      id: '7',
      type: 'transaction',
      title: 'Income Received',
      description: 'Monthly salary of ₹50,000 has been credited to your account.',
      amount: 50000,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200',
      timestamp: new Date(Date.now() - 5 * 24 * 3600000),
      read: true,
    },
  ]);

  const [filterType, setFilterType] = useState<'all' | Notification['type']>('all');

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;
    if (filterType !== 'all') {
      filtered = filtered.filter(n => n.type === filterType);
    }
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [notifications, filterType]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(
      notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      )
    );
  };

  const handleDelete = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
    toast.success('Notification deleted');
  };

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filters: Array<{ label: string; value: 'all' | Notification['type'] }> = [
    { label: 'All', value: 'all' },
    { label: 'Transactions', value: 'transaction' },
    { label: 'EMI', value: 'emi' },
    { label: 'Reminders', value: 'reminder' },
    { label: 'Investments', value: 'investment' },
    { label: 'Goals', value: 'goal' },
  ];

  return (
    <div className="w-full min-h-screen bg-gray-50 pb-32 lg:pb-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="px-4 lg:px-0 pt-6 lg:pt-10">
          <PageHeader
            title="Notifications"
            subtitle={`You have ${unreadCount} unread notifications`}
            icon={<Bell size={20} className="sm:w-6 sm:h-6" />}
            showBack
            backTo="dashboard"
          />
        </div>

        {/* Quick Actions */}
        <div className="px-4 lg:px-0 mt-8 flex gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-xl font-semibold transition-colors text-sm shadow-lg"
            >
              Mark All as Read
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="px-4 lg:px-0 mt-6 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {filters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setFilterType(filter.value)}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-semibold transition-colors text-sm ${
                  filterType === filter.value
                    ? 'bg-black text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="px-4 lg:px-0 mt-8 space-y-4">
          {filteredNotifications.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {filteredNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`border rounded-xl p-4 lg:p-6 transition-all duration-300 ${
                    notification.bgColor
                  } ${!notification.read ? 'ring-2 ring-black' : ''}`}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                      notification.bgColor.includes('red') ? 'bg-red-100' :
                      notification.bgColor.includes('orange') ? 'bg-orange-100' :
                      notification.bgColor.includes('green') ? 'bg-green-100' :
                      notification.bgColor.includes('blue') ? 'bg-blue-100' :
                      notification.bgColor.includes('purple') ? 'bg-purple-100' :
                      'bg-yellow-100'
                    }`}>
                      {notification.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm lg:text-base">
                            {notification.title}
                            {!notification.read && (
                              <span className="ml-2 inline-block w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">{notification.description}</p>
                          {notification.amount && (
                            <p className={`font-bold text-lg mt-2 ${notification.color}`}>
                              {notification.type === 'transaction' && notification.title.includes('Expense') ? '- ' : '+ '}
                              {formatCurrency(notification.amount)}
                            </p>
                          )}
                        </div>

                        {/* Time & Actions */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs text-gray-500">{getTimeAgo(notification.timestamp)}</p>
                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors mt-2"
                            aria-label="Delete notification"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Action Button */}
                      {notification.action && (
                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() => {
                              handleMarkAsRead(notification.id);
                              notification.action?.handler();
                            }}
                            className="bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                          >
                            {notification.action.label}
                          </button>
                          {!notification.read && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Bell size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg font-medium">
                {filterType === 'all' ? 'No notifications yet' : `No ${filterType} notifications`}
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Your notifications will appear here
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
