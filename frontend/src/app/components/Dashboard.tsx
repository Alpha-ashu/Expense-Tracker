import React, { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { TrendingUp, CreditCard, Wallet, Banknote, Smartphone, ArrowUpRight, ArrowDownLeft, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';

interface DashboardProps {
  setCurrentPage?: (page: string) => void;
}

export function Dashboard({ setCurrentPage }: DashboardProps) {
  const { accounts, transactions, currency } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'bank' | 'card' | 'wallet' | 'cash'>('all');

  const filteredAccounts = useMemo(() => {
    if (activeTab === 'all') return accounts;
    return accounts.filter(a => a.type === activeTab);
  }, [accounts, activeTab]);

  const filteredTransactions = useMemo(() => {
    if (activeTab === 'all') return transactions;
    const accountIds = filteredAccounts.map(a => a.id);
    return transactions.filter(t => accountIds.includes(t.accountId));
  }, [transactions, filteredAccounts, activeTab]);

  const stats = useMemo(() => ({
    totalBalance: filteredAccounts.reduce((sum, a) => sum + a.balance, 0),
    monthlyIncome: 4321.65,
    monthlyExpense: 2500.00,
  }), [filteredAccounts]);

  const chartData = [
    { name: 'Jan', value: 1200 },
    { name: 'Feb', value: 1900 },
    { name: 'Mar', value: 1500 },
    { name: 'Apr', value: 2200 },
    { name: 'May', value: 1800 },
    { name: 'Jun', value: 2400 },
    { name: 'Jul', value: 2100 },
    { name: 'Aug', value: 3800 },
    { name: 'Sep', value: 2600 },
    { name: 'Oct', value: 2900 },
    { name: 'Nov', value: 2300 },
    { name: 'Dec', value: 2800 },
  ];

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

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-gray-50 lg:bg-transparent">
      <div className="max-w-[1600px] mx-auto pb-32 lg:pb-24 w-full">
        <div className="px-4 lg:px-8 pt-6 lg:pt-10 pb-4 lg:pb-6">
          <PageHeader title="Dashboard" subtitle="Manage your financial overview" icon={<TrendingUp size={20} className="sm:w-6 sm:h-6" />} />
        </div>

        <div className="flex justify-center px-4 lg:px-8 mb-6 lg:mb-8">
          <Card variant="mesh-pink" className="w-full lg:w-[400px] p-6 lg:p-8 relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-white/80 font-medium mb-1 text-sm text-center">Total Net Worth</p>
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-white tracking-tight mb-6 text-center">{formatCurrency(stats.totalBalance)}</h2>

              <div className="flex gap-3 lg:gap-4">
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 flex-1">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                    <TrendingUp size={14} className="text-white" />
                    <span className="text-xs font-bold text-white">Income</span>
                  </div>
                  <p className="text-white font-bold text-sm lg:text-base">{formatCurrency(stats.monthlyIncome)}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 flex-1">
                  <div className="flex items-center gap-2 mb-1 opacity-80">
                    <CreditCard size={14} className="text-white" />
                    <span className="text-xs font-bold text-white">Expense</span>
                  </div>
                  <p className="text-white font-bold text-sm lg:text-base">{formatCurrency(stats.monthlyExpense)}</p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-white/10 rounded-full blur-3xl -mr-16 sm:-mr-32 -mt-16 sm:-mt-32 pointer-events-none" />
          </Card>
        </div>

        <div className="flex items-center justify-center gap-3 overflow-x-auto scrollbar-hide pb-4 px-4 sm:px-6 lg:px-8 mb-4 lg:mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'all' | 'bank' | 'card' | 'wallet' | 'cash')} className={cn(
                'relative flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 md:px-5 py-1.5 sm:py-2.5 lg:py-3 rounded-full transition-all duration-300 font-medium whitespace-nowrap text-xs sm:text-sm lg:text-base',
                isActive ? 'text-white shadow-lg shadow-pink-200' : 'bg-white text-gray-500 hover:bg-gray-50'
              )}>
                {isActive && <motion.div layoutId="activeTabPill" className="absolute inset-0 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />}
                <span className="relative z-10 flex items-center gap-1 sm:gap-2"><Icon size={14} className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px]" /><span className="inline">{tab.label}</span></span>
              </button>
            );
          })}
        </div>

        <div className="mb-6 lg:mb-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              {filteredAccounts.length > 0 ? (
                <div className="relative">
                  {/* Mobile: 2 cards per row, centered */}
                  <div className="lg:hidden">
                    <div className="flex gap-3 overflow-x-auto pb-8 px-3 sm:px-4 md:px-6 lg:px-8 snap-x snap-mandatory scrollbar-hide" style={{ scrollBehavior: 'smooth', scrollSnapType: 'x mandatory' }}>
                      {filteredAccounts.map((account, index) => (
                        <div
                          key={account.id}
                          className="snap-center shrink-0"
                          style={{
                            scrollSnapAlign: filteredAccounts.length === 1 ? 'center' : index % 2 === 0 ? 'start' : 'end',
                            scrollSnapStop: 'always',
                            width: filteredAccounts.length === 1 ? '100%' : 'calc(50% - 6px)',
                          }}
                        >
                          <Card 
                            variant={index % 2 === 0 ? 'mesh-pink' : index % 3 === 0 ? 'mesh-purple' : 'mesh-green'} 
                            onClick={() => setCurrentPage('accounts')} 
                            className="w-full h-[180px] sm:h-[190px] p-5 sm:p-6 flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                          >
                            <div className="flex justify-between items-start">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center flex-shrink-0">
                                {activeTab === 'cash' ? <Banknote className="text-white w-4 h-4 sm:w-5 sm:h-5" /> : <span className="font-bold text-white text-sm sm:text-lg">V</span>}
                              </div>
                              <div className="bg-white/20 px-2 py-0.5 sm:py-1 rounded text-xs font-bold text-white backdrop-blur-md flex-shrink-0">{account.type.toUpperCase()}</div>
                            </div>
                            <div className="space-y-2 sm:space-y-3">
                              <p className="font-display text-xl sm:text-2xl tracking-widest text-shadow-sm truncate text-white">{formatCurrency(account.balance)}</p>
                              <div className="flex justify-between items-end text-xs sm:text-sm font-medium text-white/80">
                                <span className="truncate max-w-[120px] sm:max-w-[150px]">{account.name}</span>
                                <span className="flex-shrink-0">Exp 09/29</span>
                              </div>
                            </div>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tablet: Auto-adjust based on count */}
                  <div className="hidden lg:hidden">
                    <div className="grid gap-4 px-4 md:px-6">
                      {filteredAccounts.map((account, index) => (
                        <Card 
                          key={account.id}
                          variant={index % 2 === 0 ? 'mesh-pink' : index % 3 === 0 ? 'mesh-purple' : 'mesh-green'} 
                          onClick={() => setCurrentPage('accounts')} 
                          className="h-[190px] p-6 flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                        >
                          <div className="flex justify-between items-start">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center flex-shrink-0">
                              {activeTab === 'cash' ? <Banknote className="text-white w-5 h-5" /> : <span className="font-bold text-white text-lg">V</span>}
                            </div>
                            <div className="bg-white/20 px-2 py-1 rounded text-xs font-bold text-white backdrop-blur-md flex-shrink-0">{account.type.toUpperCase()}</div>
                          </div>
                          <div className="space-y-3">
                            <p className="font-display text-2xl tracking-widest text-shadow-sm truncate text-white">{formatCurrency(account.balance)}</p>
                            <div className="flex justify-between items-end text-sm font-medium text-white/80">
                              <span className="truncate max-w-[150px]">{account.name}</span>
                              <span className="flex-shrink-0">Exp 09/29</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Desktop: All cards in one row with smooth scrolling */}
                  <div className="hidden lg:block">
                    <div className="flex gap-4 overflow-x-auto pb-8 px-8 snap-x snap-mandatory scrollbar-hide" style={{ scrollBehavior: 'smooth', scrollSnapType: 'x mandatory' }}>
                      {filteredAccounts.map((account, index) => (
                        <div
                          key={account.id}
                          className="snap-center shrink-0"
                          style={{
                            scrollSnapAlign: 'center',
                            scrollSnapStop: 'always',
                            width: '380px',
                          }}
                        >
                          <Card 
                            variant={index % 2 === 0 ? 'mesh-pink' : index % 3 === 0 ? 'mesh-purple' : 'mesh-green'} 
                            onClick={() => setCurrentPage('accounts')} 
                            className="h-[200px] p-6 flex flex-col justify-between group hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                          >
                            <div className="flex justify-between items-start">
                              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center flex-shrink-0">
                                {activeTab === 'cash' ? <Banknote className="text-white w-5 h-5" /> : <span className="font-bold text-white text-lg">V</span>}
                              </div>
                              <div className="bg-white/20 px-2 py-1 rounded text-xs font-bold text-white backdrop-blur-md flex-shrink-0">{account.type.toUpperCase()}</div>
                            </div>
                            <div className="space-y-4">
                              <p className="font-display text-3xl tracking-widest text-shadow-sm truncate text-white">{formatCurrency(account.balance)}</p>
                              <div className="flex justify-between items-end text-sm font-medium text-white/80">
                                <span className="truncate max-w-[150px]">{account.name}</span>
                                <span className="flex-shrink-0">Exp 09/29</span>
                              </div>
                            </div>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4">
                    <Wallet size={32} className="text-white opacity-50" />
                  </div>
                  <p className="text-white/80 font-medium mb-2 text-sm sm:text-base">No {activeTab === 'all' ? 'accounts' : activeTab} accounts found</p>
                  <Button variant="ghost" className="text-pink-200 hover:text-pink-100 hover:bg-white/10 text-sm sm:text-base">Add New Account</Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-4 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                  <button onClick={() => setCurrentPage('transactions')} className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">View All →</button>
                </div>

                <Card className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="block lg:hidden">
                    {filteredTransactions.slice(0, 5).map((t, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 last:border-none hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {t.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{t.description}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t.category} • {new Date(t.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
                          </div>
                        </div>
                        <span className={`font-semibold text-sm whitespace-nowrap flex-shrink-0 ${t.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</span>
                      </div>
                    ))}
                    {filteredTransactions.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No transactions found.</div>}
                  </div>

                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full min-w-max">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Transaction</th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Type</th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Date</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.slice(0, 5).map((t, i) => (
                          <tr key={i} className="group hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 last:border-none">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                  {t.type === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                </div>
                                <div className="min-w-0"><p className="font-semibold text-gray-900 text-xs truncate">{t.description}</p><p className="text-xs text-gray-500 truncate">{t.category}</p></div>
                              </div>
                            </td>
                            <td className="py-3 px-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{t.type === 'income' ? 'Income' : 'Expense'}</span></td>
                            <td className="py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{new Date(t.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</td>
                            <td className="py-3 px-4 text-right"><span className={`font-semibold text-xs whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</span></td>
                          </tr>
                        ))}
                        {filteredTransactions.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400 text-xs">No transactions found for this category.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <Card className="bg-white border border-gray-200 rounded-2xl overflow-hidden p-6">
                  <div className="flex items-center justify-between mb-6"><h3 className="font-semibold text-gray-900">Monthly Analytics</h3></div>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barSize={20}>
                        <Tooltip cursor={{ fill: 'transparent' }} content={({ active, payload }) => (active && payload && payload.length ? <div className="bg-black text-white text-xs px-3 py-1.5 rounded-lg font-semibold shadow-xl">${payload[0].value}</div> : null)} />
                        <Bar dataKey="value" radius={[6,6,6,6]}>{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.name === 'Aug' || entry.name === 'May' ? 'url(#activeBarSidebar)' : '#F3F4F6'} />)}</Bar>
                        <defs><linearGradient id="activeBarSidebar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF4B91" /><stop offset="100%" stopColor="#FF7676" /></linearGradient></defs>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 9, fontWeight: 500 }} dy={8} interval={2} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div>
                <Card className="bg-white border border-gray-200 rounded-2xl overflow-hidden p-6">
                  <div className="flex items-center justify-between mb-6"><h3 className="font-semibold text-gray-900">Quick Calendar</h3></div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-7 gap-2 text-center">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <div key={day} className="text-xs font-semibold text-gray-600 py-2">{day}</div>)}
                      {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} className="text-xs text-gray-300 py-2">-</div>)}
                      {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() }).map((_, i) => {
                        const day = i + 1; const isToday = new Date().getDate() === day && new Date().getMonth() === new Date().getMonth();
                        return (<button key={day} className={cn("text-xs font-semibold py-2 rounded-lg transition-all", isToday ? "bg-black text-white shadow-lg hover:shadow-xl" : "text-gray-600 hover:bg-gray-100")}>{day}</button>);
                      })}
                    </div>
                    <button onClick={() => setCurrentPage?.('calendar')} className="w-full text-center py-2 px-4 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors mt-4">View Full Calendar</button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
