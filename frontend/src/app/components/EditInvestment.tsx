import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { db } from '@/lib/database';
import { backendService } from '@/lib/backend-api';
import { TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export const EditInvestment: React.FC = () => {
  const { investments, setCurrentPage } = useApp();
  const [formData, setFormData] = useState({
    assetType: 'stock' as 'stock' | 'crypto' | 'forex' | 'gold' | 'silver' | 'other',
    assetName: '',
    quantity: 0,
    buyPrice: 0,
    currentPrice: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Get the investment to edit from localStorage or context
  useEffect(() => {
    const editingId = localStorage.getItem('editingInvestmentId');
    if (editingId) {
      const id = parseInt(editingId);
      setSelectedId(id);
      const investment = investments.find(i => i.id === id);
      if (investment) {
        setFormData({
          assetType: investment.assetType,
          assetName: investment.assetName,
          quantity: investment.quantity,
          buyPrice: investment.buyPrice,
          currentPrice: investment.currentPrice,
          purchaseDate: new Date(investment.purchaseDate).toISOString().split('T')[0],
        });
      }
    }
  }, [investments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedId) {
      toast.error('No investment selected');
      return;
    }

    const totalInvested = formData.quantity * formData.buyPrice;
    const currentValue = formData.quantity * formData.currentPrice;
    const profitLoss = currentValue - totalInvested;

    try {
      await backendService.updateInvestment(String(selectedId), {
        ...formData,
        totalInvested,
        currentValue,
        profitLoss,
        purchaseDate: new Date(formData.purchaseDate),
        lastUpdated: new Date(),
      });

      toast.success('Investment updated successfully');
      localStorage.removeItem('editingInvestmentId');
      setCurrentPage('investments');
    } catch (error) {
      toast.error('Failed to update investment');
      console.error(error);
    }
  };

  return (
    <CenteredLayout>
      <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Edit Investment"
        subtitle="Update your investment details"
        icon={<TrendingUp size={20} className="sm:w-6 sm:h-6" />}
        showBack
        backTo="investments"
        onBack={() => localStorage.removeItem('editingInvestmentId')}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Asset Type</label>
            <select
              value={formData.assetType}
              onChange={(e) => setFormData({ ...formData, assetType: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Asset Type"
              title="Asset Type"
            >
              <option value="stock">Stock</option>
              <option value="crypto">Cryptocurrency</option>
              <option value="forex">Forex</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Asset Name</label>
            <input
              type="text"
              value={formData.assetName}
              onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., AAPL, Bitcoin, Gold Bar"
              required
              aria-label="Asset Name"
              title="Asset Name"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
              <input
                type="number"
                step="0.01"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                aria-label="Quantity"
                title="Quantity"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buy Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.buyPrice || ''}
                onChange={(e) => setFormData({ ...formData, buyPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                aria-label="Buy Price"
                title="Buy Price"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Price</label>
            <input
              type="number"
              step="0.01"
              value={formData.currentPrice || ''}
              onChange={(e) => setFormData({ ...formData, currentPrice: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              aria-label="Current Price"
              title="Current Price"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Date</label>
            <input
              type="date"
              value={formData.purchaseDate}
              onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              aria-label="Purchase Date"
              title="Purchase Date"
              placeholder="Purchase Date"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              Total Investment: <span className="font-semibold">${(formData.quantity * formData.buyPrice).toFixed(2)}</span>
            </p>
            <p className="text-sm text-blue-700 mt-2">
              Current Value: <span className="font-semibold">${(formData.quantity * formData.currentPrice).toFixed(2)}</span>
            </p>
            <p className={`text-sm mt-2 font-semibold ${(formData.quantity * formData.currentPrice) - (formData.quantity * formData.buyPrice) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Profit/Loss: ${((formData.quantity * formData.currentPrice) - (formData.quantity * formData.buyPrice)).toFixed(2)}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('editingInvestmentId');
                setCurrentPage('investments');
              }}
              className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              aria-label="Cancel"
              title="Cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              aria-label="Update Investment"
              title="Update Investment"
            >
              Update Investment
            </button>
          </div>
        </form>
      </div>
      </div>
    </CenteredLayout>
  );
};
