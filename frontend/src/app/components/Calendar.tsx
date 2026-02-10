import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ChevronLeft, ChevronRight, Plus, X, Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/app/components/ui/PageHeader';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface Reminder {
  id: string;
  date: Date;
  title: string;
  description?: string;
  type: 'task' | 'event' | 'reminder' | 'goal';
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: Date;
  completedDate?: Date;
}

interface DailyActivityItem {
  id: string;
  type: 'income' | 'expense' | 'transfer' | 'reminder' | 'emi';
  title: string;
  description?: string;
  amount?: number;
  status?: string;
  time?: string;
  icon: string;
  color: string;
}

export const Calendar: React.FC = () => {
  const { transactions, currency } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    type: 'task' as const,
    date: new Date(),
  });

  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - monthStart.getDay());

  // Group transactions by date
  const transactionsByDate = useMemo(() => {
    const grouped: { [key: string]: typeof transactions } = {};
    transactions.forEach((transaction) => {
      if (!transaction.date) return;
      const date = new Date(transaction.date);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(transaction);
    });
    return grouped;
  }, [transactions]);

  // Group reminders by date
  const remindersByDate = useMemo(() => {
    const grouped: { [key: string]: Reminder[] } = {};
    reminders.forEach((reminder) => {
      const date = new Date(reminder.dueDate);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(reminder);
    });
    return grouped;
  }, [reminders]);

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  }, [startDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const getDateKey = (date: Date) => {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const hasActivity = (date: Date) => {
    const key = getDateKey(date);
    return (transactionsByDate[key]?.length > 0 || remindersByDate[key]?.length > 0);
  };

  const getDailyActivities = (date: Date): DailyActivityItem[] => {
    const key = getDateKey(date);
    const activities: DailyActivityItem[] = [];

    // Add transactions
    (transactionsByDate[key] || []).forEach((transaction) => {
      const typeColors: { [key: string]: { icon: string; color: string } } = {
        expense: { icon: '📉', color: 'from-red-500 to-pink-500' },
        income: { icon: '📈', color: 'from-green-500 to-emerald-500' },
        transfer: { icon: '🔄', color: 'from-blue-500 to-cyan-500' },
      };
      const typeInfo = typeColors[transaction.type] || { icon: '💰', color: 'from-gray-500 to-slate-500' };

      activities.push({
        id: String(transaction.id),
        type: transaction.type as 'income' | 'expense' | 'transfer',
        title: transaction.description,
        amount: transaction.amount,
        icon: typeInfo.icon,
        color: typeInfo.color,
        time: new Date(transaction.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
    });

    // Add reminders
    (remindersByDate[key] || []).forEach((reminder) => {
      const typeIcons: { [key: string]: string } = {
        task: '✓',
        event: '📌',
        reminder: '🔔',
        goal: '🎯',
      };
      const statusColors: { [key: string]: string } = {
        pending: 'from-yellow-500 to-orange-500',
        'in-progress': 'from-blue-500 to-purple-500',
        completed: 'from-green-500 to-emerald-500',
      };

      activities.push({
        id: reminder.id,
        type: 'reminder',
        title: reminder.title,
        description: reminder.description,
        status: reminder.status,
        icon: typeIcons[reminder.type],
        color: statusColors[reminder.status],
      });
    });

    return activities.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  };

  const addReminder = () => {
    if (!newReminder.title.trim()) return;

    const reminder: Reminder = {
      id: `reminder-${Date.now()}`,
      date: newReminder.date,
      dueDate: newReminder.date,
      title: newReminder.title,
      description: newReminder.description,
      type: newReminder.type,
      status: 'pending',
    };

    setReminders([...reminders, reminder]);
    setNewReminder({ title: '', description: '', type: 'task', date: new Date() });
    setShowReminderModal(false);
  };

  const updateReminderStatus = (id: string, status: 'pending' | 'in-progress' | 'completed') => {
    setReminders(
      reminders.map((r) =>
        r.id === id
          ? { ...r, status, completedDate: status === 'completed' ? new Date() : undefined }
          : r
      )
    );
  };

  const rescheduleReminder = (id: string, newDate: Date) => {
    setReminders(reminders.map((r) => (r.id === id ? { ...r, dueDate: newDate } : r)));
  };

  const deleteReminder = (id: string) => {
    setReminders(reminders.filter((r) => r.id !== id));
  };

  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* App Header */}
        <PageHeader
          title="Calendar"
          subtitle="Track activities, reminders & transactions"
          icon={<CalendarIcon size={20} className="sm:w-6 sm:h-6" />}
        />

        {/* Action Buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={handleToday}
            className="px-4 py-2 rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600 transition-colors text-sm sm:text-base"
          >
            Today
          </button>
          <button
            onClick={() => setShowReminderModal(true)}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm sm:text-base"
            >
              <Plus size={20} /> Add
            </button>
        </div>

        {/* Month Navigation */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-6 text-white flex items-center justify-between mb-8 shadow-xl">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-2xl sm:text-3xl font-bold">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button onClick={handleNextMonth} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Grid */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-4">
                {DAYS.map((day) => (
                  <div key={day} className="text-center font-semibold text-gray-600 text-xs sm:text-sm py-3">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                <AnimatePresence mode="wait">
                  {calendarDays.map((date, index) => {
                    const isToday = isCurrentMonth && date.getDate() === today.getDate();
                    const isSelected = selectedDate && getDateKey(date) === getDateKey(selectedDate);
                    const isCurrentMonth_ = date.getMonth() === currentDate.getMonth();
                    const hasAct = hasActivity(date);

                    return (
                      <motion.button
                        key={getDateKey(date)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          'aspect-square rounded-xl p-2 sm:p-3 transition-all duration-300 flex flex-col items-center justify-center relative',
                          isSelected
                            ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg scale-105'
                            : isToday
                            ? 'bg-gray-900 text-white shadow-md'
                            : isCurrentMonth_
                            ? 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                            : 'bg-gray-50/50 text-gray-400',
                          'font-semibold text-sm sm:text-base lg:text-lg'
                        )}
                      >
                        {date.getDate()}

                        {/* Activity Dot */}
                        {hasAct && (
                          <div className="absolute bottom-2 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 shadow-md" />
                        )}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-6 border border-red-100">
              <h3 className="text-sm font-semibold text-red-900 mb-2">Total Expenses</h3>
              <p className="text-2xl sm:text-3xl font-bold text-red-700">
                {formatCurrency(transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0))}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
              <h3 className="text-sm font-semibold text-green-900 mb-2">Total Income</h3>
              <p className="text-2xl sm:text-3xl font-bold text-green-700">
                {formatCurrency(transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Transfers</h3>
              <p className="text-2xl sm:text-3xl font-bold text-blue-700">{transactions.filter((t) => t.type === 'transfer').length}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
              <h3 className="text-sm font-semibold text-purple-900 mb-2">Reminders</h3>
              <p className="text-2xl sm:text-3xl font-bold text-purple-700">{reminders.length}</p>
            </div>
          </div>
        </div>

        {/* Daily Activity Timeline */}
        <AnimatePresence mode="wait">
          {selectedDate && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 bg-white rounded-2xl shadow-lg p-4 sm:p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Daily Activity Timeline</p>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {getDailyActivities(selectedDate).length > 0 ? (
                <div className="space-y-4">
                  {getDailyActivities(selectedDate).map((activity, idx) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-xl border-2',
                        activity.type === 'reminder'
                          ? 'bg-gradient-to-r ' + activity.color + ' bg-opacity-10 border-' + activity.color.split('-')[1] + '-300'
                          : 'bg-white border-gray-200'
                      )}
                    >
                      <div className={cn('text-2xl flex-shrink-0')}>{activity.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{activity.title}</h3>
                            {activity.description && <p className="text-sm text-gray-600 mt-1">{activity.description}</p>}
                            {activity.status && (
                              <p className="text-xs mt-2 font-medium uppercase tracking-wide">
                                Status:{' '}
                                <span
                                  className={cn(
                                    'capitalize',
                                    activity.status === 'completed'
                                      ? 'text-green-600'
                                      : activity.status === 'in-progress'
                                      ? 'text-blue-600'
                                      : 'text-yellow-600'
                                  )}
                                >
                                  {activity.status}
                                </span>
                              </p>
                            )}
                          </div>
                          {activity.amount && (
                            <div className="text-right flex-shrink-0">
                              <p className={cn('font-bold text-lg', activity.type === 'expense' ? 'text-red-600' : 'text-green-600')}>
                                {activity.type === 'expense' ? '-' : '+'}
                                {formatCurrency(activity.amount)}
                              </p>
                              {activity.time && <p className="text-xs text-gray-500 mt-1">{activity.time}</p>}
                            </div>
                          )}
                        </div>

                        {/* Reminder Actions */}
                        {activity.type === 'reminder' && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {activity.status !== 'completed' && (
                              <>
                                {activity.status !== 'in-progress' && (
                                  <button
                                    onClick={() => updateReminderStatus(activity.id, 'in-progress')}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center gap-1"
                                  >
                                    <Clock size={14} /> Start
                                  </button>
                                )}
                                <button
                                  onClick={() => updateReminderStatus(activity.id, 'completed')}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1"
                                >
                                  <CheckCircle2 size={14} /> Complete
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                const newDate = prompt('Reschedule to (YYYY-MM-DD):');
                                if (newDate) {
                                  rescheduleReminder(activity.id, new Date(newDate));
                                }
                              }}
                              className="text-xs px-3 py-1.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors flex items-center gap-1"
                            >
                              <AlertCircle size={14} /> Reschedule
                            </button>
                            <button
                              onClick={() => deleteReminder(activity.id)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors ml-auto"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No activities scheduled for this day</p>
                  <button
                    onClick={() => setShowReminderModal(true)}
                    className="mt-4 px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
                  >
                    <Plus size={18} /> Add Reminder
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Reminder Modal */}
        <AnimatePresence>
          {showReminderModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowReminderModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Add Reminder</h3>
                  <button onClick={() => setShowReminderModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Title</label>
                    <input
                      type="text"
                      value={newReminder.title}
                      onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                      placeholder="Add reminder title"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Description (Optional)</label>
                    <textarea
                      value={newReminder.description}
                      onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                      placeholder="Add details"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none h-20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Type</label>
                    <select
                      value={newReminder.type}
                      onChange={(e) => setNewReminder({ ...newReminder, type: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="task">Task</option>
                      <option value="event">Event</option>
                      <option value="reminder">Reminder</option>
                      <option value="goal">Goal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Date</label>
                    <input
                      type="date"
                      value={newReminder.date.toISOString().split('T')[0]}
                      onChange={(e) => setNewReminder({ ...newReminder, date: new Date(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setShowReminderModal(false)}
                      className="flex-1 px-4 py-2 rounded-lg bg-gray-200 text-gray-900 font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addReminder}
                      className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold hover:from-pink-600 hover:to-rose-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
