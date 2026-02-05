import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { ChevronLeft, ChevronRight, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import type { Loan, Transaction } from '@/lib/database';

export const Calendar: React.FC = () => {
  const { transactions, loans, currency } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Get events for each day
  const getEventsForDay = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const events: any[] = [];

    // Add transactions (expenses, income)
    transactions.forEach(t => {
      const transDate = new Date(t.date);
      if (transDate.toDateString() === dateStr.toDateString()) {
        events.push({
          type: 'transaction',
          label: `${t.type === 'income' ? 'Income' : 'Expense'}: ${t.description}`,
          amount: t.amount,
          isIncome: t.type === 'income',
        });
      }
    });

    // Add EMI due dates
    loans.forEach(loan => {
      if (loan.startDate) {
        const loanDate = new Date(loan.startDate);
        // Simple EMI calculation - on the same day each month
        if (loanDate.getDate() === day && loanDate.getMonth() <= currentDate.getMonth()) {
          const monthDiff = (currentDate.getFullYear() - loanDate.getFullYear()) * 12 + (currentDate.getMonth() - loanDate.getMonth());
          if (monthDiff >= 0 && monthDiff < loan.tenure) {
            events.push({
              type: 'emi',
              label: `EMI Due: ${loan.description || 'Loan Payment'}`,
              amount: loan.amount / loan.tenure,
              loanId: loan.id,
            });
          }
        }
      }
    });

    return events;
  };

  const calendarDays = useMemo(() => {
    const days = [];
    const totalDays = daysInMonth(currentDate);
    const startingDayOfWeek = firstDayOfMonth(currentDate);

    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Days of the month
    for (let day = 1; day <= totalDays; day++) {
      days.push(day);
    }

    return days;
  }, [currentDate]);

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const todayDate = new Date();
  const isToday = (day: number) =>
    day === todayDate.getDate() &&
    currentDate.getMonth() === todayDate.getMonth() &&
    currentDate.getFullYear() === todayDate.getFullYear();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Financial Calendar</h2>
        <p className="text-gray-500 mt-1">View upcoming payments, EMI, and financial events</p>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h3 className="text-xl font-semibold">{monthName}</h3>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0 border-b border-gray-200 bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-4 text-center font-semibold text-gray-600 text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-0 bg-white">
          {calendarDays.map((day, index) => {
            const events = day ? getEventsForDay(day) : [];
            const isTodayDate = day && isToday(day);

            return (
              <div
                key={index}
                className={`min-h-32 border border-gray-200 p-2 ${
                  !day ? 'bg-gray-50' : isTodayDate ? 'bg-blue-50' : ''
                }`}
              >
                {day && (
                  <>
                    <div className={`text-sm font-semibold mb-1 ${
                      isTodayDate ? 'text-blue-600 bg-blue-200 rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-900'
                    }`}>
                      {day}
                    </div>
                    <div className="space-y-1 text-xs">
                      {events.map((event, i) => (
                        <div
                          key={i}
                          className={`p-1 rounded text-xs font-medium text-white line-clamp-2 ${
                            event.type === 'transaction'
                              ? event.isIncome
                                ? 'bg-green-500'
                                : 'bg-red-500'
                              : 'bg-orange-500'
                          }`}
                          title={event.label}
                        >
                          {event.type === 'transaction' && (event.isIncome ? '📈' : '📉')}
                          {event.type === 'emi' && '💳'}
                          {' '}{event.label.split(':')[1]?.trim() || event.label}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Upcoming Income */}
        <div className="bg-green-50 p-6 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="text-green-600" size={24} />
            <h3 className="font-semibold text-green-900">Upcoming Income</h3>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {transactions
              .filter(
                t =>
                  t.type === 'income' &&
                  new Date(t.date) >= currentDate &&
                  new Date(t.date) < new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
              )
              .map(t => (
                <div key={t.id} className="text-sm text-green-700">
                  <p className="font-medium">{t.description}</p>
                  <p className="text-green-600">{formatCurrency(t.amount)}</p>
                </div>
              ))}
            {transactions.filter(
              t =>
                t.type === 'income' &&
                new Date(t.date) >= currentDate &&
                new Date(t.date) < new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
            ).length === 0 && <p className="text-gray-500 text-sm">No upcoming income</p>}
          </div>
        </div>

        {/* Upcoming Expenses */}
        <div className="bg-red-50 p-6 rounded-xl border border-red-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="text-red-600" size={24} />
            <h3 className="font-semibold text-red-900">Upcoming Expenses</h3>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {transactions
              .filter(
                t =>
                  t.type === 'expense' &&
                  new Date(t.date) >= currentDate &&
                  new Date(t.date) < new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
              )
              .map(t => (
                <div key={t.id} className="text-sm text-red-700">
                  <p className="font-medium">{t.description}</p>
                  <p className="text-red-600">{formatCurrency(t.amount)}</p>
                </div>
              ))}
            {transactions.filter(
              t =>
                t.type === 'expense' &&
                new Date(t.date) >= currentDate &&
                new Date(t.date) < new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
            ).length === 0 && <p className="text-gray-500 text-sm">No upcoming expenses</p>}
          </div>
        </div>

        {/* Upcoming EMI */}
        <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="text-orange-600" size={24} />
            <h3 className="font-semibold text-orange-900">Upcoming EMI</h3>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {loans
              .filter(loan => loan.status === 'active')
              .map(loan => {
                const emiAmount = loan.amount / loan.tenure;
                return (
                  <div key={loan.id} className="text-sm text-orange-700">
                    <p className="font-medium">{loan.description || 'Loan EMI'}</p>
                    <p className="text-orange-600">{formatCurrency(emiAmount)}</p>
                  </div>
                );
              })}
            {loans.filter(loan => loan.status === 'active').length === 0 && (
              <p className="text-gray-500 text-sm">No active EMI</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
