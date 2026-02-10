import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { ChevronLeft, Plus, Users, Mail, Phone, X } from 'lucide-react';
import { toast } from 'sonner';

interface Friend {
  id?: number;
  name: string;
  email: string;
  phone: string;
  relationship: 'family' | 'friend' | 'colleague' | 'roommate' | 'other';
  color: string;
}

export const AddFriends: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [formData, setFormData] = useState<Friend>({
    name: '',
    email: '',
    phone: '',
    relationship: 'friend',
    color: '#3b82f6',
  });

  const [friends, setFriends] = useState<Friend[]>([]);
  const [isAddingFriend, setIsAddingFriend] = useState(false);

  const colors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter friend name');
      return;
    }

    if (!formData.email && !formData.phone) {
      toast.error('Please enter email or phone number');
      return;
    }

    const newFriend: Friend = {
      ...formData,
      id: Math.random().toString(36).substr(2, 9),
    };

    setFriends([...friends, newFriend]);
    toast.success(`${formData.name} added to friends list`);

    setFormData({
      name: '',
      email: '',
      phone: '',
      relationship: 'friend',
      color: '#3b82f6',
    });
    setIsAddingFriend(false);
  };

  const handleSaveFriends = async () => {
    if (friends.length === 0) {
      toast.error('Please add at least one friend');
      return;
    }

    try {
      for (const friend of friends) {
        await db.friends.add({
          ...friend,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      toast.success(`${friends.length} friend(s) added successfully`);
      setCurrentPage('groups');
    } catch (error) {
      console.error('Failed to add friends:', error);
      toast.error('Failed to add friends');
    }
  };

  const handleRemoveFriend = (id: string | undefined) => {
    if (id) {
      setFriends(friends.filter(f => f.id !== id));
      toast.success('Friend removed');
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
              Add Friends
            </h2>
            <p className="text-gray-500 mt-1">Manage friends for group expenses and bill splitting</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 max-w-4xl">
          {/* Add Friend Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Add New Friend</h3>

            {!isAddingFriend && friends.length > 0 && (
              <button
                onClick={() => setIsAddingFriend(true)}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-4 py-3 rounded-xl font-semibold transition-colors mb-6 flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add Another Friend
              </button>
            )}

            {(isAddingFriend || friends.length === 0) && (
              <form onSubmit={handleAddFriend} className="space-y-4">
                {/* Friend Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Friend Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    placeholder="e.g., John Doe"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Mail size={16} className="text-gray-500" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    placeholder="john@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Phone size={16} className="text-gray-500" />
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    placeholder="+91 98765 43210"
                  />
                </div>

                {/* Relationship */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Relationship</label>
                  <select
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  >
                    <option value="friend">Friend</option>
                    <option value="family">Family</option>
                    <option value="colleague">Colleague</option>
                    <option value="roommate">Roommate</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Profile Color</label>
                  <div className="flex gap-3">
                    {colors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-10 h-10 rounded-full transition-transform ring-2 ring-offset-2 ${
                          formData.color === color
                            ? 'ring-gray-400 scale-110'
                            : 'ring-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-black hover:bg-gray-900 text-white py-3 rounded-xl font-semibold transition-colors shadow-lg"
                  >
                    Add Friend
                  </button>
                  {friends.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsAddingFriend(false)}
                      className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-semibold transition-colors"
                    >
                      Done Adding
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Friends List */}
          {friends.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                Added Friends ({friends.length})
              </h3>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: friend.color }}
                    >
                      {friend.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{friend.name}</p>
                      <p className="text-xs text-gray-500">
                        {friend.email || friend.phone || 'No contact info'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        {friends.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 max-w-4xl">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">💡 Tip:</span> Add friends here to easily split group expenses and track who owes whom. You can add email addresses or phone numbers to send payment reminders.
            </p>
          </div>
        )}

        {/* Save Button */}
        {friends.length > 0 && (
          <div className="flex gap-3 max-w-4xl">
            <button
              onClick={handleSaveFriends}
              className="flex-1 bg-black hover:bg-gray-900 text-white py-3 rounded-xl font-semibold transition-colors shadow-lg"
            >
              Save Friends & Continue
            </button>
            <button
              onClick={() => setCurrentPage('groups')}
              className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </CenteredLayout>
  );
};
