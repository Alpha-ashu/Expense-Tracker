import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';import { CenteredLayout } from '@/app/components/CenteredLayout';import { db } from '@/lib/database';
import { ChevronLeft, Plus, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export const AddInvestment: React.FC = () => {
  const { setCurrentPage, currency } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    type: 'stocks' as 'stocks' | 'bonds' | 'mutual-funds' | 'real-estate' | 'crypto' | 'other',
    amount: 0,
    quantity: 0,
    purchasePrice: 0,
    currentPrice: 0,
    date: new Date().toISOString().split('T')[0],
    broker: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.amount <= 0) {
      toast.error('Investment amount must be greater than 0');
      return;
    }

    try {
      await db.investments.add({
        ...formData,
        date: new Date(formData.date),
        currentValue: formData.currentPrice * formData.quantity,
        gain: (formData.currentPrice - formData.purchasePrice) * formData.quantity,
        gainPercentage: ((formData.currentPrice - formData.purchasePrice) / formData.purchasePrice) * 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      toast.success('Investment added successfully');
      setCurrentPage('investments');
    } catch (error) {
      console.error('Failed to add investment:', error);
      toast.error('Failed to add investment');
    }
  };

  const currentValue = formData.currentPrice * formData.quantity;
  const investmentGain = (formData.currentPrice - formData.purchasePrice) * formData.quantity;
  const gainPercentage = formData.purchasePrice > 0 ? (investmentGain / (formData.purchasePrice * formData.quantity)) * 100 : 0;

  return (
    <CenteredLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentPage('investments')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={28} />
            Add Investment
          </h2>
          <p className="text-gray-500 mt-1">Track your investment portfolio</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Investment Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Apple Stock"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="stocks">Stocks</option>
              <option value="bonds">Bonds</option>
              <option value="mutual-funds">Mutual Funds</option>
              <option value="real-estate">Real Estate</option>
              <option value="crypto">Cryptocurrency</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
            <input
              type="number"
              step="0.01"
              value={formData.quantity || ''}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Price Per Unit</label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-3 text-lg">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={formData.purchasePrice || ''}
                onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Price Per Unit</label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-3 text-lg">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={formData.currentPrice || ''}
                onChange={(e) => setFormData({ ...formData, currentPrice: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Initial Investment Amount *</label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-3 text-lg">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Broker (Optional)</label>
            <input
              type="text"
              value={formData.broker}
              onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Fidelity, Vanguard"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add any notes about this investment"
              rows={3}
            />
          </div>

          {/* Summary */}
          {formData.quantity > 0 && formData.currentPrice > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Current Value:</span>
                  <span className="font-bold text-blue-600">{currency} {currentValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Gain/Loss:</span>
                  <span className={`font-bold ${investmentGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {investmentGain >= 0 ? '+' : ''}{currency} {investmentGain.toFixed(2)} ({gainPercentage.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => setCurrentPage('investments')}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Investment
            </button>
          </div>
        </form>
      </div>
      </div>
    </CenteredLayout>
  );
};;
