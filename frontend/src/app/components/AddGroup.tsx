import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { ChevronLeft, Users } from 'lucide-react';
import { toast } from 'sonner';

export const AddGroup: React.FC = () => {
  const { setCurrentPage, currency } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    participants: [''],
    totalAmount: 0,
    amountPerPerson: 0,
    category: 'general',
    date: new Date().toISOString().split('T')[0],
  });

  const handleAddParticipant = () => {
    setFormData({ ...formData, participants: [...formData.participants, ''] });
  };

  const handleRemoveParticipant = (index: number) => {
    setFormData({
      ...formData,
      participants: formData.participants.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validParticipants = formData.participants.filter(p => p.trim());
    if (validParticipants.length < 2) {
      toast.error('Please add at least 2 participants');
      return;
    }

    if (formData.totalAmount <= 0) {
      toast.error('Total amount must be greater than 0');
      return;
    }

    try {
      await db.groups.add({
        id: Date.now().toString(),
        name: formData.name,
        members: validParticipants,
        createdAt: new Date(),
      });
      toast.success('Group expense created successfully');
      setCurrentPage('groups');
    } catch (error) {
      console.error('Failed to create group:', error);
      toast.error('Failed to create group expense');
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentPage('groups')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Create Group Expense
          </h2>
          <p className="text-gray-500 mt-1">Split expenses with friends and family</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Weekend Trip"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Total Amount *</label>
            <div className="flex items-center">
              <span className="text-gray-600 mr-3 text-lg">{currency}</span>
              <input
                type="number"
                step="0.01"
                value={formData.totalAmount || ''}
                onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="general">General</option>
              <option value="food">Food & Dining</option>
              <option value="travel">Travel</option>
              <option value="entertainment">Entertainment</option>
              <option value="rent">Rent/Accommodation</option>
              <option value="utilities">Utilities</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Add details about this group expense"
              rows={3}
            />
          </div>

          {/* Participants */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Participants *</label>
              <button
                type="button"
                onClick={handleAddParticipant}
                className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
              >
                + Add Participant
              </button>
            </div>
            <div className="space-y-2">
              {formData.participants.map((participant, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={participant}
                    onChange={(e) => {
                      const newParticipants = [...formData.participants];
                      newParticipants[index] = e.target.value;
                      setFormData({ ...formData, participants: newParticipants });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter participant name"
                  />
                  {formData.participants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {formData.participants.length > 0 && formData.totalAmount > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 font-medium">
                  Amount per person: {currency} {(formData.totalAmount / formData.participants.filter(p => p.trim()).length).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => setCurrentPage('groups')}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Group Expense
            </button>
          </div>
        </form>
      </div>
      </div>
    </CenteredLayout>
  );
};
