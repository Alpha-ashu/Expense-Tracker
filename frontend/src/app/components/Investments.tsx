import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { Plus, TrendingUp, TrendingDown, Edit2, Trash2, BarChart3, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/app/components/DeleteConfirmModal';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { LiveMarket } from '@/app/components/LiveMarket';
import { LiveMarketTicker } from '@/app/components/LiveMarketTicker';

const COLORS = ['#000000', '#666666', '#999999', '#CCCCCC', '#E5E5E5', '#F0F0F0'];

type Tab = 'portfolio' | 'market';

export const Investments: React.FC = () => {
  const { investments, currency, setCurrentPage } = useApp();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [investmentToDelete, setInvestmentToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');

  const portfolioStats = useMemo(() => {
    const totalInvested = investments.reduce((sum, i) => sum + i.totalInvested, 0);
    const currentValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
    const profitLoss = currentValue - totalInvested;
    const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

    const assetAllocation = investments.reduce((acc: any, inv) => {
      if (!acc[inv.assetType]) acc[inv.assetType] = 0;
      acc[inv.assetType] += inv.currentValue;
      return acc;
    }, {});

    const chartData = Object.entries(assetAllocation).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

    return { totalInvested, currentValue, profitLoss, profitLossPercent, chartData };
  }, [investments]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const handleDeleteInvestment = (investmentId: number, investmentName: string) => {
    setInvestmentToDelete({ id: investmentId, name: investmentName });
    setDeleteModalOpen(true);
  };

  const confirmDeleteInvestment = async () => {
    if (!investmentToDelete) return;
    setIsDeleting(true);
    try {
      await db.investments.delete(investmentToDelete.id);
      toast.success('Investment deleted successfully');
      setDeleteModalOpen(false);
      setInvestmentToDelete(null);
    } catch (error) {
      console.error('Failed to delete investment:', error);
      toast.error('Failed to delete investment');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 lg:py-10 max-w-[1600px] mx-auto space-y-6 sm:space-y-8 pb-24">
      {/* ── Header ── */}
      <PageHeader
        title="Investments"
        subtitle="Track your investment portfolio"
        icon={<BarChart3 size={20} className="sm:w-6 sm:h-6" />}
      >
        <Button
          onClick={() => setCurrentPage('add-investment')}
          className="rounded-full h-9 sm:h-10 px-3 sm:px-4 shadow-lg bg-black text-white hover:bg-gray-900 transition-transform active:scale-95 text-xs sm:text-sm"
        >
          <Plus size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Add Investment
        </Button>
      </PageHeader>

      {/* ── Live Market Ticker ── */}
      <div className="-mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8">
        <LiveMarketTicker />
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
        {([
          { id: 'portfolio', label: 'My Portfolio', icon: BarChart3 },
          { id: 'market',    label: 'Live Market',  icon: Activity  },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200',
              activeTab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ LIVE MARKET TAB ══════════════ */}
      {activeTab === 'market' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start"
        >
          {/* LiveMarket panel — grows with viewport, min capped so it's usable on short screens */}
          <div className="lg:col-span-2 min-h-[480px] h-auto lg:h-[calc(100svh-22rem)] lg:max-h-[820px]">
            <LiveMarket />
          </div>

          {/* Info sidebar */}
          <div className="lg:col-span-3 space-y-4">
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-display font-bold text-gray-900 mb-1">About Live Market Data</h3>
              <p className="text-sm text-gray-500 mb-4">
                Live prices from NSE and BSE via Yahoo Finance. No login required.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Exchange',    value: 'NSE + BSE',            icon: '🇮🇳' },
                  { label: 'Delay',       value: '~15 min (after hours)', icon: '⏱️' },
                  { label: 'Auth Needed', value: 'None — Free',           icon: '🔓' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-4">
                    <p className="text-2xl mb-2">{icon}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ══════════════ MY PORTFOLIO TAB ══════════════ */}
      {activeTab === 'portfolio' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 sm:space-y-8"
        >
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card variant="glass" className="p-4 sm:p-6 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-2xl flex items-center justify-center mb-2 sm:mb-4 shadow-sm">
                    <TrendingUp className="text-white" size={18} />
                  </div>
                  <p className="text-gray-500 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Total Invested</p>
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-gray-900 tracking-tight">
                    {formatCurrency(portfolioStats.totalInvested)}
                  </h3>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card variant="glass" className="p-4 sm:p-6 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-2xl flex items-center justify-center mb-2 sm:mb-4 shadow-sm">
                    <BarChart3 className="text-white" size={18} />
                  </div>
                  <p className="text-gray-500 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Current Value</p>
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-gray-900 tracking-tight">
                    {formatCurrency(portfolioStats.currentValue)}
                  </h3>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card variant={portfolioStats.profitLoss >= 0 ? 'mesh-green' : 'mesh-red'} className="p-4 sm:p-6 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 sm:mb-4">
                    {portfolioStats.profitLoss >= 0
                      ? <TrendingUp className="text-white" size={18} />
                      : <TrendingDown className="text-white" size={18} />}
                  </div>
                  <p className="text-white/80 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Profit / Loss</p>
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                    {portfolioStats.profitLoss >= 0 ? '+' : ''}{formatCurrency(portfolioStats.profitLoss)}
                  </h3>
                  <p className="text-white/80 text-xs sm:text-sm mt-0.5 sm:mt-1">
                    {portfolioStats.profitLoss >= 0 ? '+' : ''}{portfolioStats.profitLossPercent.toFixed(2)}%
                  </p>
                </div>
                <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              </Card>
            </motion.div>
          </div>

          {/* Charts */}
          {investments.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card variant="glass" className="p-6">
                <h3 className="text-lg font-display font-bold text-gray-900 mb-4">Asset Allocation</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={portfolioStats.chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {portfolioStats.chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card variant="glass" className="p-6">
                <h3 className="text-lg font-display font-bold text-gray-900 mb-4">Top Performers</h3>
                <div className="space-y-3">
                  {[...investments]
                    .sort((a, b) => (b.profitLoss / b.totalInvested) - (a.profitLoss / a.totalInvested))
                    .slice(0, 5)
                    .map(inv => {
                      const plPercent = (inv.profitLoss / inv.totalInvested) * 100;
                      return (
                        <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div>
                            <p className="font-display font-bold text-gray-900 text-sm">{inv.assetName}</p>
                            <p className="text-xs text-gray-500 capitalize mt-0.5">{inv.assetType}</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-bold text-sm ${inv.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {inv.profitLoss >= 0 ? '+' : ''}{formatCurrency(inv.profitLoss)}
                            </p>
                            <p className={`text-xs ${inv.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Card>
            </div>
          )}

          {/* ── Portfolio Table — desktop only ── */}
          <Card variant="glass" className="overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Buy Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">P/L</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {investments.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{inv.assetName}</div>
                        <div className="text-sm text-gray-500">{new Date(inv.purchaseDate).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 capitalize">{inv.assetType}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{inv.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{formatCurrency(inv.buyPrice)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{formatCurrency(inv.currentPrice)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">{formatCurrency(inv.currentValue)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${inv.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {inv.profitLoss >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          {inv.profitLoss >= 0 ? '+' : ''}{formatCurrency(inv.profitLoss)}
                        </div>
                        <div className="text-xs">
                          {inv.profitLoss >= 0 ? '+' : ''}{((inv.profitLoss / inv.totalInvested) * 100).toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => { localStorage.setItem('editingInvestmentId', inv.id.toString()); setCurrentPage('edit-investment'); }}
                            className="text-gray-600 hover:text-gray-900 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteInvestment(inv.id!, inv.assetName)}
                            className="text-red-600 hover:text-red-900 transition-colors p-1.5 hover:bg-red-100 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Portfolio Cards — mobile only ── */}
          {investments.length > 0 && (
            <div className="sm:hidden space-y-3">
              {investments.map(inv => {
                const plPercent = (inv.profitLoss / inv.totalInvested) * 100;
                const isProfit = inv.profitLoss >= 0;
                return (
                  <Card key={inv.id} variant="glass" className="p-4">
                    {/* Row 1: name + actions */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-display font-bold text-gray-900 text-base truncate">{inv.assetName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 capitalize">{inv.assetType}</span>
                          <span className="text-xs text-gray-400">{new Date(inv.purchaseDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => { localStorage.setItem('editingInvestmentId', inv.id.toString()); setCurrentPage('edit-investment'); }}
                          className="text-gray-500 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-xl"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteInvestment(inv.id!, inv.assetName)}
                          className="text-red-500 hover:text-red-700 transition-colors p-2 hover:bg-red-50 rounded-xl"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: key numbers grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-0.5">Qty</p>
                        <p className="text-sm font-bold text-gray-900">{inv.quantity}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-0.5">Buy Price</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.buyPrice)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-0.5">Current Price</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.currentPrice)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-0.5">Total Value</p>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.currentValue)}</p>
                      </div>
                    </div>

                    {/* Row 3: P/L badge */}
                    <div className={`mt-3 flex items-center gap-1.5 px-3 py-2 rounded-xl ${isProfit ? 'bg-green-50' : 'bg-red-50'}`}>
                      {isProfit ? <TrendingUp size={15} className="text-green-600" /> : <TrendingDown size={15} className="text-red-600" />}
                      <span className={`text-sm font-bold ${isProfit ? 'text-green-700' : 'text-red-700'}`}>
                        {isProfit ? '+' : ''}{formatCurrency(inv.profitLoss)}
                      </span>
                      <span className={`text-xs font-medium ml-auto ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfit ? '+' : ''}{plPercent.toFixed(2)}%
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {investments.length === 0 && (
            <Card variant="glass" className="p-12 text-center border-2 border-dashed border-gray-300">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
                <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <BarChart3 className="text-white" size={32} />
                </div>
                <h3 className="text-2xl font-display font-bold text-gray-900 mb-2">No investments yet</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">Start tracking your investment portfolio today</p>
                <Button
                  onClick={() => setCurrentPage('add-investment')}
                  className="rounded-full h-11 px-6 shadow-lg bg-black text-white hover:bg-gray-900 transition-transform active:scale-95"
                >
                  <Plus size={18} className="mr-2" />
                  Add Your First Investment
                </Button>
              </motion.div>
            </Card>
          )}
        </motion.div>
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Investment"
        message="This investment record will be permanently deleted. All transaction history will be lost."
        itemName={investmentToDelete?.name}
        isLoading={isDeleting}
        onConfirm={confirmDeleteInvestment}
        onCancel={() => { setDeleteModalOpen(false); setInvestmentToDelete(null); }}
      />
    </div>
  );
};