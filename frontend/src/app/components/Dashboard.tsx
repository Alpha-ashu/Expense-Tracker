import React, { useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { Wallet, TrendingUp, TrendingDown, Target, CreditCard, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1'];

export const Dashboard: React.FC = () => {
  const { accounts, transactions, loans, goals, investments, currency } = useApp();

  const stats = useMemo(() => {
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const monthlyExpenses = transactions
      .filter(t => t.type === 'expense' && new Date(t.date) >= thisMonth)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const monthlyIncome = transactions
      .filter(t => t.type === 'income' && new Date(t.date) >= thisMonth)
      .reduce((sum, t) => sum + t.amount, 0);

    const activeLoans = loans.filter(l => l.status === 'active');
    const totalDebt = activeLoans.reduce((sum, l) => sum + l.outstandingBalance, 0);

    const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount);
    const goalsProgress = activeGoals.reduce((sum, g) => sum + (g.currentAmount / g.targetAmount * 100), 0) / (activeGoals.length || 1);

    const totalInvested = investments.reduce((sum, i) => sum + i.totalInvested, 0);
    const currentInvestmentValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
    const investmentPL = currentInvestmentValue - totalInvested;

    return {
      monthlyExpenses,
      monthlyIncome,
      totalDebt,
      activeLoans: activeLoans.length,
      activeGoals: activeGoals.length,
      goalsProgress,
      totalInvested,
      investmentPL,
    };
  }, [transactions, loans, goals, investments]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });
    
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions]);

  const last7DaysData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate.toDateString() === date.toDateString();
      });
      
      const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      
      data.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        income,
        expense,
      });
    }
    return data;
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500 mt-1">Welcome to your financial overview</p>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Income"
          value={formatCurrency(stats.monthlyIncome)}
          icon={<TrendingUp className="text-green-500" />}
          trend="+12.5%"
          positive
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(stats.monthlyExpenses)}
          icon={<TrendingDown className="text-red-500" />}
          trend="-8.3%"
          positive
        />
        <StatCard
          title="Active Loans"
          value={`${stats.activeLoans}`}
          subtitle={`Total: ${formatCurrency(stats.totalDebt)}`}
          icon={<CreditCard className="text-orange-500" />}
        />
        <StatCard
          title="Active Goals"
          value={`${stats.activeGoals}`}
          subtitle={`Avg Progress: ${stats.goalsProgress.toFixed(0)}%`}
          icon={<Target className="text-blue-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={last7DaysData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="income" fill="#10B981" name="Income" />
              <Bar dataKey="expense" fill="#EF4444" name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Expenses by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Accounts Overview</h3>
            <Wallet className="text-blue-500" size={24} />
          </div>
          <div className="space-y-3">
            {accounts.filter(a => a.isActive).slice(0, 5).map(account => (
              <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{account.name}</p>
                  <p className="text-sm text-gray-500 capitalize">{account.type}</p>
                </div>
                <p className="font-semibold text-gray-900">{formatCurrency(account.balance)}</p>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="text-gray-500 text-center py-8">No accounts added yet</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Investment Portfolio</h3>
            <TrendingUp className="text-green-500" size={24} />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Total Invested</p>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalInvested)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">P/L</p>
                <p className={`text-xl font-bold ${stats.investmentPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.investmentPL >= 0 ? '+' : ''}{formatCurrency(stats.investmentPL)}
                </p>
              </div>
            </div>
            {investments.slice(0, 3).map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{inv.assetName}</p>
                  <p className="text-sm text-gray-500 capitalize">{inv.assetType}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(inv.currentValue)}</p>
                  <p className={`text-sm ${inv.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {inv.profitLoss >= 0 ? '+' : ''}{formatCurrency(inv.profitLoss)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
        <div className="space-y-2">
          {transactions.slice(0, 8).map(transaction => {
            const account = accounts.find(a => a.id === transaction.accountId);
            return (
              <div key={transaction.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {transaction.type === 'income' ? (
                      <TrendingUp className="text-green-600" size={20} />
                    ) : (
                      <TrendingDown className="text-red-600" size={20} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    <p className="text-sm text-gray-500">
                      {transaction.category} • {account?.name} • {new Date(transaction.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </p>
              </div>
            );
          })}
          {transactions.length === 0 && (
            <p className="text-gray-500 text-center py-8">No transactions yet</p>
          )}
        </div>
      </div>
      </div>
    </CenteredLayout>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  positive?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, trend, positive }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-sm mt-2 ${positive ? 'text-green-500' : 'text-red-500'}`}>
              {trend} from last month
            </p>
          )}
        </div>
        <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
};
