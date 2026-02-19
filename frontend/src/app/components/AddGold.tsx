import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { backendService } from '@/lib/backend-api';
import { ChevronLeft, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface GoldEntry {
  type: 'gold' | 'jewelry' | 'coin';
  quantity: number;
  unit: 'gram' | 'ounce' | 'kg';
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  purityPercentage: number;
  location: string;
  certificateNumber?: string;
  notes?: string;
}

export const AddGold: React.FC = () => {
  const { setCurrentPage, currency } = useApp();
  const [formData, setFormData] = useState<GoldEntry>({
    type: 'gold',
    quantity: 0,
    unit: 'gram',
    purchasePrice: 0,
    currentPrice: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    purityPercentage: 99.5,
    location: 'safe-deposit-box',
    certificateNumber: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    if (formData.purchasePrice <= 0) {
      toast.error('Purchase price must be greater than 0');
      return;
    }

    if (formData.purityPercentage <= 0 || formData.purityPercentage > 100) {
      toast.error('Purity must be between 0 and 100%');
      return;
    }

    try {
      await backendService.createGold({
        ...formData,
        purchaseDate: new Date(formData.purchaseDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const totalValue = formData.quantity * formData.currentPrice;
      toast.success(`Gold entry added! Current value: ${currency} ${totalValue.toFixed(2)}`);
      setCurrentPage('investments');
    } catch (error) {
      console.error('Failed to add gold entry:', error);
      toast.error('Failed to add gold entry');
    }
  };

  const totalValue = formData.quantity * formData.currentPrice;
  const totalInvestment = formData.quantity * formData.purchasePrice;
  const gainLoss = totalValue - totalInvestment;
  const gainLossPercentage = totalInvestment > 0 ? (gainLoss / totalInvestment) * 100 : 0;

  return (
    <CenteredLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage('investments')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to Investments"
            title="Back to Investments"
          >
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="text-yellow-600" size={28} />
              Add Gold Investment
            </h2>
            <p className="text-gray-500 mt-1">Track your gold holdings and investments</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Gold Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Gold Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50"
                aria-label="Gold Type"
                title="Gold Type"
              >
                <option value="gold">Pure Gold</option>
                <option value="jewelry">Gold Jewelry</option>
                <option value="coin">Gold Coin</option>
              </select>
            </div>

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Quantity *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quantity || ''}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Unit *</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50"
                  aria-label="Gold Unit"
                  title="Gold Unit"
                >
                  <option value="gram">Gram</option>
                  <option value="ounce">Ounce</option>
                  <option value="kg">Kilogram</option>
                </select>
              </div>
            </div>

            {/* Purity Percentage */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Purity Percentage *</label>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.purityPercentage || ''}
                  onChange={(e) => setFormData({ ...formData, purityPercentage: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50"
                  placeholder="99.5"
                  required
                />
                <span className="text-gray-600 ml-3">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Common: 99.9% (24K), 91.67% (22K), 75% (18K), 58.5% (14K)
              </p>
            </div>

            {/* Purchase Price Per Unit */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Purchase Price per {formData.unit} *</label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.purchasePrice || ''}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Current Price Per Unit */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Current Price per {formData.unit} *</label>
              <div className="flex items-center">
                <span className="text-gray-600 mr-3">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.currentPrice || ''}
                  onChange={(e) => setFormData({ ...formData, currentPrice: parseFloat(e.target.value) || 0 })}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Purchase Date *</label>
              <input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50"
                required
                aria-label="Gold Purchase Date"
                title="Gold Purchase Date"
                placeholder="Gold Purchase Date"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Storage Location</label>
              <select
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50"
                aria-label="Gold Location"
                title="Gold Location"
              >
                <option value="safe-deposit-box">Safe Deposit Box</option>
                <option value="home-safe">Home Safe</option>
                <option value="locker">Bank Locker</option>
                <option value="jewelry-shop">Jewelry Shop</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Certificate Number (Optional) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Certificate/Reference Number</label>
              <input
                type="text"
                value={formData.certificateNumber || ''}
                onChange={(e) => setFormData({ ...formData, certificateNumber: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-gray-50"
                placeholder="e.g., CERT-2024-001"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none bg-gray-50"
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>

            {/* Value Summary */}
            {formData.quantity > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-3">Investment Summary</h3>
                <div className="space-y-2 text-sm text-yellow-800">
                  <div className="flex justify-between">
                    <span>Total Investment:</span>
                    <span className="font-medium">{currency} {totalInvestment.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Value:</span>
                    <span className="font-medium">{currency} {totalValue.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-yellow-200 pt-2 mt-2 flex justify-between">
                    <span>Gain/Loss:</span>
                    <span className={`font-semibold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {gainLoss >= 0 ? '+' : ''}{currency} {gainLoss.toFixed(2)} ({gainLossPercentage.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-black hover:bg-gray-900 text-white py-3 rounded-xl font-semibold transition-colors shadow-lg"
            >
              Add Gold Investment
            </button>
          </form>
        </div>
      </div>
    </CenteredLayout>
  );
};
