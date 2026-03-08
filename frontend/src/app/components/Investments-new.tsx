import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import {
  Plus, TrendingUp, TrendingDown, Edit2, Trash2,
  BarChart3, Activity,
} from 'lucide-react';
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
      <PageHeader
        title="Investments"
        subtitle="Track your portfolio & live market prices"
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
          { id: 'market', label: 'Live Market', icon: Activity },
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

      {/* ── Live Market tab ── */}
      {activeTab === 'market' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Watchlist panel */}
          <div className="lg:col-span-1 h-[640px]">
            <LiveMarket />
          </div>

          {/* Market info card */}
          <div className="lg:col-span-2 space-y-4">
            <Card variant="glass" className="p-6">
              <h3 className="text-lg font-display font-bold text-gray-900 mb-1">About Live Market Data</h3>
              <p className="text-sm text-gray-500 mb-4">
                Live prices from NSE and BSE via Yahoo Finance. No login required.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Exchange', value: 'NSE + BSE', icon: '🇮🇳' },
                  { label: 'Delay', value: '~15 min (after hours)', icon: '⏱️' },
                  { label: 'Auth Needed', value: 'None — Free', icon: '🔓' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-4">
                    <p className="text-2xl mb-2">{icon}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-800">
                  ⚠️ <strong>Disclaimer:</strong> Prices shown are for informational purposes only and may be delayed.
                  Do not use for real-time trading decisions. Data sourced via Yahoo Finance.
                </p>
              </div>
            </Card>

            <Card variant="glass" className="p-6">
              <h3 className="text-base font-display font-bold text-gray-900 mb-3">How to use</h3>
              <ol className="space-y-2 text-sm text-gray-600 list-none">
                {[
                  'Click any stock in the watchlist to see detailed price information',
                  'Use the search box to find and add new stocks (NSE or BSE)',
                  'Prices auto-refresh every 60 seconds during market hours',
                  'Click the refresh button to manually fetch the latest prices',
                  'Use .NS suffix for NSE (default) or .BO for BSE',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-black text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ── Portfolio tab ── */}
      {activeTab === 'portfolio' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card variant="glass" className="p-4 sm:p-6 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-2xl flex items-center justify-center mb-2 sm:mb-4 shadow-sm">
                    <TrendingUp className="text-white sm:w-5 sm:h-5" size={18} />
                  </div>
                  <p className="text-gray-500 font-medium mb-0.5 sm:mb-1 text-xs sm:text-sm uppercase tracking-wide">Total Invested</p>
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-gray-900 tracking-tight">
                    {formatCurrency(portfolioStats.totalInvested)}
                  </h3>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card variant="glass" className="p-6 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    <BarChart3 className="text-white" size={20} />
                  </div>
                  <p className="text-gray-500 font-medium mb-1 text-sm uppercase tracking-wide">Current Value</p>
                  <h3 className="text-2xl font-display font-bold text-gray-900 tracking-tight">
                    {formatCurrency(portfolioStats.currentValue)}
                  </h3>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card variant={portfolioStats.profitLoss >= 0 ? 'mesh-green' : 'mesh-red'} className="p-6 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4">
                    {portfolioStats.profitLoss >= 0 ? <TrendingUp className="text-white" size={20} /> : <TrendingDown className="text-white" size={20} />}
                  </div>
                  <p className="text-white/80 font-medium mb-1 text-sm uppercase tracking-wide">Profit/Loss</p>
                  <h3 className="text-2xl font-display font-bold text-white tracking-tight">
                    {portfolioStats.profitLoss >= 0 ? '+' : ''}{formatCurrency(portfolioStats.profitLoss)}
                  </h3>
                  <p className="text-white/80 text-sm mt-1">
                    {portfolioStats.profitLoss >= 0 ? '+' : ''}{portfolioStats.profitLossPercent.toFixed(2)}%
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
              </Card>
            </motion.div>
          </div>

          {investments.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card variant="glass" className="p-6">
                <h3 className="text-lg font-display font-bold text-gray-900 mb-4">Asset Allocation</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={portfolioStats.chartData}
                      cx="50%" cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
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
                    .sort((a, b) => ((b.profitLoss / b.totalInvested) - (a.profitLoss / a.totalInvested)))
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

          {/* Holdings grid/list */}
          {investments.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-display font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 className="text-gray-400" size={20} />
                Your Individual Holdings
              </h3>
              
              <div className="space-y-4">
                {/* Desktop Header row - hidden on small screens */}
                <div className="hidden lg:flex gap-4 font-bold text-xs text-gray-400 uppercase tracking-wider px-6 mb-2">
                  <div className="flex-[2] min-w-[200px]">Asset</div>
                  <div className="w-24">Type</div>
                  <div className="flex-1 text-right">Qty & Price</div>
                  <div className="flex-1 text-right">Total Value</div>
                  <div className="flex-1 text-right">Profit / Loss</div>
                  <div className="w-16 text-right">Actions</div>
                </div>
                
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {investments.map((inv, idx) => {
                    const plPercent = (inv.profitLoss / inv.totalInvested) * 100;
                    const isProfitable = inv.profitLoss >= 0;
                    
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: 0.1 * idx }}
                        key={inv.id} 
                        className="flex flex-col lg:flex-row lg:items-center gap-4 bg-white/60 backdrop-blur-sm border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all rounded-2xl p-4 sm:px-6 group"
                      >
                        {/* 1. Asset Info (Takes up row on mobile, flex-2 on desktop) */}
                        <div className="flex items-start lg:items-center justify-between lg:flex-[2] lg:min-w-[200px] w-full gap-4">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                              isProfitable ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                              {isProfitable ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                            </div>
                            <div>
                              <div className="font-display font-bold text-gray-900 text-base sm:text-lg group-hover:text-blue-600 transition-colors line-clamp-1">{inv.assetName}</div>
                              <div className="text-[10px] sm:text-xs font-semibold text-gray-400">Bought {new Date(inv.purchaseDate).toLocaleDateString()}</div>
                            </div>
                          </div>
                          
                          {/* Actions mobile only */}
                          <div className="flex lg:hidden flex-col sm:flex-row gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                localStorage.setItem('editingInvestmentId', inv.id.toString());
                                setCurrentPage('edit-investment');
                              }}
                              className="bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition-colors p-2 rounded-xl"
                              title="Edit investment"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteInvestment(inv.id!, inv.assetName)}
                              className="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 transition-colors p-2 rounded-xl"
                              title="Delete investment"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Middle Content Wrapper for Mobile Grid */}
                        <div className="grid grid-cols-2 lg:flex lg:flex-1 w-full gap-4 lg:gap-4 items-center">
                          {/* Type Badge */}
                          <div className="lg:w-24">
                            <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-gray-100/80 text-gray-600 uppercase tracking-widest block w-fit">
                              {inv.assetType}
                            </span>
                          </div>

                          {/* Price & Quantity */}
                          <div className="lg:flex-1 lg:text-right">
                            <div className="text-xs text-gray-400 lg:hidden uppercase tracking-widest mb-0.5">Quantity / Avg</div>
                            <div className="text-sm font-bold text-gray-900">{inv.quantity} units</div>
                            <div className="text-xs text-gray-500">at {formatCurrency(inv.buyPrice)}</div>
                          </div>

                          {/* Total Value */}
                          <div className="lg:flex-1 lg:text-right">
                            <div className="text-xs text-gray-400 lg:hidden uppercase tracking-widest mb-0.5">Value</div>
                            <div className="text-base sm:text-lg font-bold text-gray-900">{formatCurrency(inv.currentValue)}</div>
                            <div className="text-[10px] sm:text-xs text-gray-400 line-clamp-1">Current: {formatCurrency(inv.currentPrice)}</div>
                          </div>

                          {/* Profit/Loss */}
                          <div className="col-span-2 lg:col-span-1 lg:flex-1 flex flex-row lg:flex-col items-center justify-between lg:items-end mt-2 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100/60">
                            <div className="text-xs text-gray-400 font-bold uppercase lg:hidden tracking-wider">Profit/Loss</div>
                            <div className="flex flex-row lg:flex-col items-center lg:items-end gap-3 lg:gap-1.5">
                              <div className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1 lg:py-1.5 rounded-xl text-sm font-bold shadow-sm",
                                isProfitable ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              )}>
                                {isProfitable ? '+' : ''}{formatCurrency(inv.profitLoss)}
                              </div>
                              <div className={cn("text-xs font-bold px-1", isProfitable ? "text-emerald-500" : "text-rose-500")}>
                                {isProfitable ? '+' : ''}{plPercent.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions desktop only */}
                        <div className="hidden lg:flex w-16 justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => {
                              localStorage.setItem('editingInvestmentId', inv.id.toString());
                              setCurrentPage('edit-investment');
                            }}
                            className="bg-gray-100 hover:bg-black hover:text-white text-gray-600 transition-colors p-2 rounded-xl"
                            title="Edit investment"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteInvestment(inv.id!, inv.assetName)}
                            className="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 transition-colors p-2 rounded-xl"
                            title="Delete investment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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
        onCancel={() => {
          setDeleteModalOpen(false);
          setInvestmentToDelete(null);
        }}
      />
    </div>
  );
};