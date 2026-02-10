import React, { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Download, TrendingUp } from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { motion } from 'framer-motion';

export const Reports: React.FC = () => {
  const { transactions, accounts, loans, goals, investments, currency } = useApp();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const getDaysCount = () => {
    switch (timeRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
    }
  };

  const cashFlowData = useMemo(() => {
    const days = getDaysCount();
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const dayTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.toDateString() === date.toDateString();
      });
      
      const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        income,
        expense,
        net: income - expense,
      });
    }
    
    return data;
  }, [transactions, timeRange]);

  const categoryBreakdown = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });
    
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [transactions]);

  const summaryStats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    const totalDebt = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.outstandingBalance, 0);
    const totalGoalsProgress = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalInvested = investments.reduce((sum, i) => sum + i.totalInvested, 0);

    return {
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      totalDebt,
      totalGoalsProgress,
      totalInvested,
    };
  }, [transactions, loans, goals, investments]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 lg:py-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 pb-24">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Insights into your financial health"
        icon={<TrendingUp size={20} className="sm:w-6 sm:h-6" />}
      >
        <Button className="rounded-full h-9 sm:h-10 px-3 sm:px-4 shadow-lg bg-black text-white hover:bg-gray-900 transition-transform active:scale-95 text-xs sm:text-sm">
          <Download size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </PageHeader>

      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
        <div className="flex items-center gap-1 sm:gap-2 bg-white border-2 border-gray-200 rounded-full p-1 shadow-sm flex-shrink-0">
          {(['7d', '30d', '90d', '1y'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                timeRange === range
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {range === '1y' ? '1Y' : range === '7d' ? '7D' : range === '30d' ? '30D' : '90D'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card variant="glass" className="p-4 sm:p-6">
            <p className="text-gray-500 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Total Income</p>
            <p className="text-xl sm:text-2xl font-display font-bold text-green-600">{formatCurrency(summaryStats.totalIncome)}</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card variant="glass" className="p-4 sm:p-6">
            <p className="text-gray-500 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Total Expenses</p>
            <p className="text-xl sm:text-2xl font-display font-bold text-red-600">{formatCurrency(summaryStats.totalExpenses)}</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card variant="glass" className="p-4 sm:p-6">
            <p className="text-gray-500 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Net Savings</p>
            <p className={`text-xl sm:text-2xl font-display font-bold ${summaryStats.netSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summaryStats.netSavings)}
            </p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card variant="glass" className="p-4 sm:p-6">
            <p className="text-gray-500 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Savings Rate</p>
            <p className={`text-xl sm:text-2xl font-display font-bold ${summaryStats.savingsRate >= 20 ? 'text-green-600' : 'text-orange-600'}`}>
              {summaryStats.savingsRate.toFixed(1)}%
            </p>
          </Card>
        </motion.div>
      </div>

      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-display font-bold text-gray-900 mb-4">Cash Flow Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} name="Income" />
            <Line type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={2} name="Expenses" />
            <Line type="monotone" dataKey="net" stroke="#000000" strokeWidth={2} name="Net" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-display font-bold text-gray-900 mb-4">Top Expense Categories</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="value" fill="#000000" name="Amount" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-display font-bold text-gray-900 mb-4">Financial Summary</h3>
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Active Debt</p>
              <p className="text-xl font-display font-bold text-gray-900 mt-1">{formatCurrency(summaryStats.totalDebt)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Goals Progress</p>
              <p className="text-xl font-display font-bold text-gray-900 mt-1">{formatCurrency(summaryStats.totalGoalsProgress)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Invested</p>
              <p className="text-xl font-display font-bold text-gray-900 mt-1">{formatCurrency(summaryStats.totalInvested)}</p>
            </div>
            <div className="p-4 bg-black/5 rounded-xl border-2 border-black/10">
              <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Net Worth</p>
              <p className="text-xl font-display font-bold text-gray-900 mt-1">
                {formatCurrency(
                  accounts.reduce((sum, a) => sum + a.balance, 0) +
                  summaryStats.totalGoalsProgress +
                  summaryStats.totalInvested -
                  summaryStats.totalDebt
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card variant="glass" className="p-6">
        <h3 className="text-lg font-display font-bold text-gray-900 mb-4">Expense Breakdown</h3>
        <div className="space-y-3">
          {categoryBreakdown.map((cat) => {
            const percentage = (cat.value / summaryStats.totalExpenses) * 100;
            return (
              <div key={cat.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-gray-700">{cat.name}</span>
                  <span className="font-bold text-gray-900">{formatCurrency(cat.value)} ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-black h-2.5 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
