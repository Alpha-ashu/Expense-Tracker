import React, { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { TrendingUp, CreditCard, Wallet, Banknote, Smartphone, ArrowUpRight, ArrowDownLeft, Plus, Calendar, Target, Users, TrendingDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { TimeFilter, TimeFilterPeriod, filterByTimePeriod, getPeriodLabel } from '@/app/components/ui/TimeFilter';

interface DashboardProps {
  setCurrentPage?: (page: string) => void;
}

export function Dashboard({ setCurrentPage }: DashboardProps) {
  const { accounts, transactions, goals, loans, investments, currency } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'bank' | 'card' | 'wallet' | 'cash'>('all');
  const [timePeriod, setTimePeriod] = useState<TimeFilterPeriod>('monthly');

  const filteredAccounts = useMemo(() => {
    if (activeTab === 'all') return accounts;
    return accounts.filter(a => a.type === activeTab);
  }, [accounts, activeTab]);

  // Filter transactions by time period
  const timeFilteredTransactions = useMemo(() => {
    return filterByTimePeriod(transactions, timePeriod);
  }, [transactions, timePeriod]);

  const filteredTransactions = useMemo(() => {
    if (activeTab === 'all') return timeFilteredTransactions;
    const accountIds = filteredAccounts.map(a => a.id);
    return timeFilteredTransactions.filter(t => accountIds.includes(t.accountId));
  }, [timeFilteredTransactions, filteredAccounts, activeTab]);

  const stats = useMemo(() => ({
    totalBalance: accounts.filter(a => a.isActive).reduce((sum, a) => sum + a.balance, 0),
    monthlyIncome: timeFilteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    monthlyExpense: timeFilteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    savingsRate: timeFilteredTransactions.length > 0 
      ? ((timeFilteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) - 
         timeFilteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)) /
        timeFilteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)) * 100
      : 0,
  }), [accounts, timeFilteredTransactions]);

  const recentTransactions = useMemo(() => {
    return filteredTransactions.slice(0, 5);
  }, [filteredTransactions]);

  const upcomingBills = useMemo(() => {
    // Filter for recurring expenses and upcoming bills
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return transactions.filter(t => 
      t.type === 'expense' && 
      t.date >= now && 
      t.date <= thirtyDaysFromNow &&
      (t.category === 'bills' || t.category === 'subscriptions' || t.description.toLowerCase().includes('emi'))
    ).slice(0, 3);
  }, [transactions]);

  const activeGoals = useMemo(() => {
    return goals.filter(g => g.currentAmount < g.targetAmount).slice(0, 3);
  }, [goals]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount);

  const tabs = [
    { id: 'all', label: 'All Assets', icon: TrendingUp },
    { id: 'bank', label: 'Banks', icon: Wallet },
    { id: 'card', label: 'Cards', icon: CreditCard },
    { id: 'wallet', label: 'Digital', icon: Smartphone },
    { id: 'cash', label: 'Cash', icon: Banknote },
  ];

  const EmptyState = ({ title, description, icon: Icon, action }: { 
    title: string; 
    description: string; 
    icon: React.ElementType;
    action?: { label: string; onClick: () => void };
  }) => (
    <Card className="p-8 text-center">
      <Icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-4">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="rounded-full">
          {action.label}
        </Button>
      )}
    </Card>
  );

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-gray-50">
      <div className="max-w-full mx-auto pb-32 lg:pb-8 w-full">
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 lg:pt-8 pb-4 lg:pb-6">
          <PageHeader title="Dashboard" subtitle="Manage your financial overview" icon={<TrendingUp size={20} className="sm:w-6 sm:h-6" />} />
        </div>

        {/* Time Filter */}
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TimeFilter value={timePeriod} onChange={setTimePeriod} />
            <p className="text-sm text-gray-500 font-medium">{getPeriodLabel(timePeriod)}</p>
          </div>
        </div>

        {/* Financial Health Overview */}
        <div className="flex justify-center px-4 sm:px-6 lg:px-8 xl:px-12 mb-6 lg:mb-8">
          <Card variant="mesh-pink" className="w-full max-w-md lg:max-w-lg p-6 lg:p-8 relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-white/80 font-medium mb-1 text-sm text-center">Total Net Worth</p>
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-white tracking-tight mb-6 text-center">
                {formatCurrency(stats.totalBalance)}
              </h2>

              <div className="grid grid-cols-2 gap-3 lg:gap-4">
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                    <TrendingUp size={14} className="text-white" />
                    <span className="text-xs font-bold text-white">Income</span>
                  </div>
                  <p className="text-white font-bold text-sm lg:text-base">{formatCurrency(stats.monthlyIncome)}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                    <TrendingDown size={14} className="text-white" />
                    <span className="text-xs font-bold text-white">Expense</span>
                  </div>
                  <p className="text-white font-bold text-sm lg:text-base">{formatCurrency(stats.monthlyExpense)}</p>
                </div>
              </div>
              
              {stats.monthlyIncome > 0 && (
                <div className="mt-4 bg-white/20 backdrop-blur-md rounded-2xl p-3">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                    <Target size={14} className="text-white" />
                    <span className="text-xs font-bold text-white">Savings Rate</span>
                  </div>
                  <p className="text-white font-bold text-sm lg:text-base">{stats.savingsRate.toFixed(1)}%</p>
                </div>
              )}
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-white/10 rounded-full blur-3xl -mr-16 sm:-mr-32 -mt-16 sm:-mt-32 pointer-events-none" />
          </Card>
        </div>

        {/* Asset Type Tabs */}
        <div className="flex items-center justify-center gap-3 overflow-x-auto scrollbar-hide pb-4 px-4 sm:px-6 lg:px-8 xl:px-12 mb-4 lg:mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as 'all' | 'bank' | 'card' | 'wallet' | 'cash')} 
                className={cn(
                  'relative flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 md:px-5 py-1.5 sm:py-2.5 lg:py-3 rounded-full transition-all duration-300 font-medium whitespace-nowrap text-xs sm:text-sm lg:text-base',
                  isActive ? 'text-white shadow-lg shadow-pink-200' : 'bg-white text-gray-500 hover:bg-gray-50'
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTabPill" 
                    className="absolute inset-0 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full" 
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} 
                  />
                )}
                <span className="relative z-10 flex items-center gap-1 sm:gap-2">
                  <Icon size={14} className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px]" />
                  <span className="inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Accounts Section */}
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12 mb-6 lg:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Accounts</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage?.('accounts')}
              className="rounded-full"
            >
              View All
            </Button>
          </div>
          
          <AnimatePresence mode="wait">
            {filteredAccounts.length > 0 ? (
              <motion.div 
                key={activeTab} 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }} 
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {filteredAccounts.slice(0, 4).map((account) => (
                  <Card key={account.id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        account.type === 'bank' ? "bg-blue-100 text-blue-600" :
                        account.type === 'card' ? "bg-purple-100 text-purple-600" :
                        account.type === 'wallet' ? "bg-green-100 text-green-600" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {account.type === 'bank' && <Wallet size={20} />}
                        {account.type === 'card' && <CreditCard size={20} />}
                        {account.type === 'wallet' && <Smartphone size={20} />}
                        {account.type === 'cash' && <Banknote size={20} />}
                      </div>
                      {!account.isActive && (
                        <span className="text-xs text-gray-500">Inactive</span>
                      )}
                    </div>
                    <h4 className="font-medium text-gray-900 truncate mb-1">{account.name}</h4>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(account.balance)}</p>
                  </Card>
                ))}
              </motion.div>
            ) : (
              <EmptyState
                title="No accounts yet"
                description="Add your first account to start tracking your finances"
                icon={Wallet}
                action={{ label: "Add Account", onClick: () => setCurrentPage?.('add-account') }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Recent Transactions */}
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12 mb-6 lg:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage?.('transactions')}
              className="rounded-full"
            >
              View All
            </Button>
          </div>
          
          <AnimatePresence>
            {recentTransactions.length > 0 ? (
              <Card className="divide-y divide-gray-100">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        transaction.type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      )}>
                        {transaction.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{transaction.description}</p>
                        <p className="text-sm text-gray-500">{transaction.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-semibold",
                        transaction.type === 'income' ? "text-green-600" : "text-red-600"
                      )}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </Card>
            ) : (
              <EmptyState
                title="No transactions yet"
                description="Start adding transactions to see your financial activity"
                icon={CreditCard}
                action={{ label: "Add Transaction", onClick: () => setCurrentPage?.('add-transaction') }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Upcoming Bills */}
        {upcomingBills.length > 0 && (
          <div className="px-4 sm:px-6 lg:px-8 xl:px-12 mb-6 lg:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Bills</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage?.('calendar')}
                className="rounded-full"
              >
                View Calendar
              </Button>
            </div>
            
            <Card className="divide-y divide-gray-100">
              {upcomingBills.map((bill, index) => (
                <div key={bill.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                      <AlertCircle size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{bill.description}</p>
                      <p className="text-sm text-gray-500">
                        Due {new Date(bill.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-red-600">{formatCurrency(bill.amount)}</p>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <div className="px-4 sm:px-6 lg:px-8 xl:px-12 mb-6 lg:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Goals Progress</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage?.('goals')}
                className="rounded-full"
              >
                View All
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeGoals.map((goal) => {
                const progress = (goal.currentAmount / goal.targetAmount) * 100;
                return (
                  <Card key={goal.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 truncate">{goal.name}</h4>
                      <Target size={16} className="text-gray-400" />
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>{formatCurrency(goal.currentAmount)}</span>
                        <span>{formatCurrency(goal.targetAmount)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-blue-600">{progress.toFixed(0)}% Complete</p>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
