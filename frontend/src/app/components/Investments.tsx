import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { Plus, TrendingUp, TrendingDown, Edit2, Trash2, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/app/components/DeleteConfirmModal';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = ['#000000', '#666666', '#999999', '#CCCCCC', '#E5E5E5', '#F0F0F0'];

export const Investments: React.FC = () => {
  const { investments, currency, setCurrentPage } = useApp();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [investmentToDelete, setInvestmentToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const portfolioStats = useMemo(() => {
    const totalInvested = investments.reduce((sum, i) => sum + i.totalInvested, 0);
    const currentValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
    const profitLoss = currentValue - totalInvested;
    const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

    const assetAllocation = investments.reduce((acc: any, inv) => {
      if (!acc[inv.assetType]) {
        acc[inv.assetType] = 0;
      }
      acc[inv.assetType] += inv.currentValue;
      return acc;
    }, {});

    const chartData = Object.entries(assetAllocation).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

    return { totalInvested, currentValue, profitLoss, profitLossPercent, chartData };
  }, [investments]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card variant="glass" className="p-4 sm:p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-2xl flex items-center justify-center mb-2 sm:mb-4 shadow-sm">
                <TrendingUp className="text-white" size={18} className="sm:w-5 sm:h-5" />
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
          <Card variant={portfolioStats.profitLoss >= 0 ? "mesh-green" : "mesh-red"} className="p-6 relative overflow-hidden">
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
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {portfolioStats.chartData.map((entry, index) => (
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

      <Card variant="glass" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Buy Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Current Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">P/L</th>
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
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 capitalize">
                      {inv.assetType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {inv.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {formatCurrency(inv.buyPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {formatCurrency(inv.currentPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                    {formatCurrency(inv.currentValue)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${
                    inv.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
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
                        onClick={() => {
                          localStorage.setItem('editingInvestmentId', inv.id.toString());
                          setCurrentPage('edit-investment');
                        }}
                        className="text-gray-600 hover:text-gray-900 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
                        title="Edit investment"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteInvestment(inv.id!, inv.assetName)}
                        className="text-red-600 hover:text-red-900 transition-colors p-1.5 hover:bg-red-100 rounded-lg"
                        title="Delete investment"
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

      {investments.length === 0 && (
        <Card variant="glass" className="p-12 text-center border-2 border-dashed border-gray-300">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
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