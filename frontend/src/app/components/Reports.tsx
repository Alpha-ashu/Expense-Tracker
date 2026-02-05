import React, { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, Download } from 'lucide-react';

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
    <CenteredLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-500 mt-1">Insights into your financial health</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {range === '1y' ? '1 Year' : range.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download size={20} />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Total Income</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(summaryStats.totalIncome)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(summaryStats.totalExpenses)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Net Savings</p>
          <p className={`text-2xl font-bold ${summaryStats.netSavings >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {formatCurrency(summaryStats.netSavings)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Savings Rate</p>
          <p className={`text-2xl font-bold ${summaryStats.savingsRate >= 20 ? 'text-green-600' : 'text-orange-600'}`}>
            {summaryStats.savingsRate.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Cash Flow Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} name="Income" />
            <Line type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={2} name="Expenses" />
            <Line type="monotone" dataKey="net" stroke="#3B82F6" strokeWidth={2} name="Net" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Top Expense Categories</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="value" fill="#3B82F6" name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Financial Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Total Active Debt</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summaryStats.totalDebt)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Goals Progress</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summaryStats.totalGoalsProgress)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Total Invested</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(summaryStats.totalInvested)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <p className="text-sm text-blue-600">Net Worth</p>
                <p className="text-xl font-bold text-blue-700">
                  {formatCurrency(
                    accounts.reduce((sum, a) => sum + a.balance, 0) +
                    summaryStats.totalGoalsProgress +
                    summaryStats.totalInvested -
                    summaryStats.totalDebt
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Expense Breakdown</h3>
        <div className="space-y-2">
          {categoryBreakdown.map((cat) => {
            const percentage = (cat.value / summaryStats.totalExpenses) * 100;
            return (
              <div key={cat.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{cat.name}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(cat.value)} ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </CenteredLayout>
  );
};
