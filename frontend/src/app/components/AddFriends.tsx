import React, { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { db } from '@/lib/database';
import styles from './AddFriends.module.css';
import { backendService } from '@/lib/backend-api';
import { Users, Mail, Phone, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Friend {
  id?: number;
  name: string;
  email: string;
  phone: string;
  relationship: 'family' | 'friend' | 'colleague' | 'roommate' | 'other';
  color: string;
}

const defaultFriendForm = (): Friend => ({
  name: '',
  email: '',
  phone: '',
  relationship: 'friend',
  color: '#3b82f6',
});

const EDITING_FRIEND_ID_KEY = 'editingFriendId';
const EDITING_FRIEND_BACK_PAGE_KEY = 'editingFriendBackPage';

export const AddFriends: React.FC = () => {
  const { setCurrentPage, refreshData, friends: savedFriends } = useApp();
  const [formData, setFormData] = useState<Friend>(defaultFriendForm);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [editingFriendId, setEditingFriendId] = useState<number | null>(null);
  const [editingFriendBackPage, setEditingFriendBackPage] = useState('groups');
  const [isUpdatingFriend, setIsUpdatingFriend] = useState(false);
  const [isDeletingFriend, setIsDeletingFriend] = useState(false);

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

  useEffect(() => {
    const storedId = localStorage.getItem(EDITING_FRIEND_ID_KEY);
    if (!storedId) {
      setEditingFriendId(null);
      return;
    }

    const parsedId = Number(storedId);
    if (!Number.isFinite(parsedId)) {
      localStorage.removeItem(EDITING_FRIEND_ID_KEY);
      localStorage.removeItem(EDITING_FRIEND_BACK_PAGE_KEY);
      setEditingFriendId(null);
      return;
    }

    const friendToEdit = savedFriends.find((friend) => friend.id === parsedId);
    if (!friendToEdit) {
      localStorage.removeItem(EDITING_FRIEND_ID_KEY);
      localStorage.removeItem(EDITING_FRIEND_BACK_PAGE_KEY);
      setEditingFriendId(null);
      return;
    }

    setEditingFriendId(parsedId);
    setEditingFriendBackPage(localStorage.getItem(EDITING_FRIEND_BACK_PAGE_KEY) || 'groups');
    setFormData({
      ...defaultFriendForm(),
      name: friendToEdit.name,
      email: friendToEdit.email || '',
      phone: friendToEdit.phone || '',
    });
    setFriends([]);
    setIsAddingFriend(true);
  }, [savedFriends]);

  const resetForm = () => {
    setFormData(defaultFriendForm());
  };

  const clearEditingState = () => {
    localStorage.removeItem(EDITING_FRIEND_ID_KEY);
    localStorage.removeItem(EDITING_FRIEND_BACK_PAGE_KEY);
    setEditingFriendId(null);
    setEditingFriendBackPage('groups');
  };

  const returnFromEditor = () => {
    const nextPage = editingFriendBackPage || 'groups';
    clearEditingState();
    resetForm();
    setIsAddingFriend(false);
    setCurrentPage(nextPage);
  };

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

    const normalizedName = formData.name.trim().toLowerCase();
    const normalizedEmail = formData.email.trim().toLowerCase();
    const normalizedPhone = formData.phone.trim();

    const alreadySaved = savedFriends.some((friend) =>
      friend.name.trim().toLowerCase() === normalizedName
      || (!!normalizedEmail && friend.email?.trim().toLowerCase() === normalizedEmail)
      || (!!normalizedPhone && friend.phone?.trim() === normalizedPhone)
    );

    if (alreadySaved) {
      toast.error('This friend is already saved');
      return;
    }

    const alreadyQueued = friends.some((friend) =>
      friend.name.trim().toLowerCase() === normalizedName
      || (!!normalizedEmail && friend.email.trim().toLowerCase() === normalizedEmail)
      || (!!normalizedPhone && friend.phone.trim() === normalizedPhone)
    );

    if (alreadyQueued) {
      toast.error('This friend is already in the list');
      return;
    }

    const newFriend: Friend = {
      ...formData,
      id: Date.now(),
    };

    setFriends([...friends, newFriend]);
    toast.success(`${formData.name} added to friends list`);

    resetForm();
    setIsAddingFriend(false);
  };

  const handleUpdateFriend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingFriendId) return;

    if (!formData.name.trim()) {
      toast.error('Please enter friend name');
      return;
    }

    if (!formData.email && !formData.phone) {
      toast.error('Please enter email or phone number');
      return;
    }

    const normalizedName = formData.name.trim().toLowerCase();
    const normalizedEmail = formData.email.trim().toLowerCase();
    const normalizedPhone = formData.phone.trim();

    const duplicateFriend = savedFriends.some((friend) =>
      friend.id !== editingFriendId && (
        friend.name.trim().toLowerCase() === normalizedName
        || (!!normalizedEmail && friend.email?.trim().toLowerCase() === normalizedEmail)
        || (!!normalizedPhone && friend.phone?.trim() === normalizedPhone)
      )
    );

    if (duplicateFriend) {
      toast.error('Another saved friend already uses these details');
      return;
    }

    setIsUpdatingFriend(true);

    try {
      const updatedAt = new Date();
      const nextName = formData.name.trim();
      const nextEmail = formData.email.trim() || undefined;
      const nextPhone = formData.phone.trim() || undefined;

      await db.transaction('rw', db.friends, db.groupExpenses, async () => {
        await db.friends.update(editingFriendId, {
          name: nextName,
          email: nextEmail,
          phone: nextPhone,
          updatedAt,
        });

        const groups = await db.groupExpenses.toArray();
        for (const group of groups) {
          let hasChanges = false;
          const updatedMembers = group.members.map((member) => {
            if (member.friendId !== editingFriendId) {
              return member;
            }

            hasChanges = true;
            return {
              ...member,
              name: nextName,
              email: nextEmail,
              phone: nextPhone,
            };
          });

          if (hasChanges && group.id) {
            await db.groupExpenses.update(group.id, {
              members: updatedMembers,
              updatedAt,
            });
          }
        }
      });

      await refreshData();
      toast.success('Friend updated successfully');
      returnFromEditor();
    } catch (error) {
      console.error('Failed to update friend:', error);
      toast.error('Failed to update friend');
    } finally {
      setIsUpdatingFriend(false);
    }
  };

  const handleDeleteSavedFriend = async () => {
    if (!editingFriendId) return;

    setIsDeletingFriend(true);
    try {
      await db.friends.delete(editingFriendId);
      await refreshData();
      toast.success('Friend removed successfully');
      returnFromEditor();
    } catch (error) {
      console.error('Failed to delete friend:', error);
      toast.error('Failed to delete friend');
    } finally {
      setIsDeletingFriend(false);
    }
  };

  const handleSaveFriends = async () => {
    if (friends.length === 0) {
      toast.error('Please add at least one friend');
      return;
    }

    try {
      for (const friend of friends) {
        await backendService.createFriend({
          ...friend,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      toast.success(`${friends.length} friend(s) added successfully`);
      setFriends([]);
      refreshData();
      setCurrentPage('groups');
    } catch (error) {
      console.error('Failed to add friends:', error);
      toast.error('Failed to add friends');
    }
  };

  const handleRemoveFriend = (id: number | undefined) => {
    if (id) {
      setFriends(friends.filter(f => f.id !== id));
      toast.success('Friend removed');
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6 max-w-[480px] w-full mx-auto pb-8">
        <PageHeader
          title={editingFriendId ? 'Edit Friend' : 'Add Friends'}
          subtitle={editingFriendId ? 'Update saved friend details for future splits' : 'Manage friends for group expenses and bill splitting'}
          icon={<Users size={20} className="sm:w-6 sm:h-6" />}
          showBack
          backTo={editingFriendBackPage || 'groups'}
          onBack={editingFriendId ? returnFromEditor : undefined}
        />

        <div className="flex flex-col gap-6">
          {/* Add Friend Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              {editingFriendId ? 'Edit Friend Details' : 'Add New Friend'}
            </h3>

            {!editingFriendId && !isAddingFriend && friends.length > 0 && (
              <button
                onClick={() => setIsAddingFriend(true)}
                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 px-4 py-3 rounded-xl font-semibold transition-colors mb-6 flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add Another Friend
              </button>
            )}

            {(editingFriendId || isAddingFriend || friends.length === 0) && (
              <form onSubmit={editingFriendId ? handleUpdateFriend : handleAddFriend} className="space-y-4">
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
                    aria-label="Friend Name"
                    title="Friend Name"
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
                    aria-label="Friend Email"
                    title="Friend Email"
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
                    aria-label="Friend Phone"
                    title="Friend Phone"
                  />
                </div>

                {!editingFriendId && (
                  <>
                    {/* Relationship */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-3">Relationship</label>
                      <select
                        value={formData.relationship}
                        onChange={(e) => setFormData({ ...formData, relationship: e.target.value as any })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        aria-label="Relationship"
                        title="Relationship"
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
                            className={
                              `${styles.colorCircle} ` +
                              (formData.color === color ? styles.selectedColor : styles.unselectedColor) + ' ' +
                              (color === '#3b82f6' ? styles.colorBlue :
                                color === '#ef4444' ? styles.colorRed :
                                  color === '#10b981' ? styles.colorGreen :
                                    color === '#f59e0b' ? styles.colorAmber :
                                      color === '#8b5cf6' ? styles.colorPurple :
                                        color === '#ec4899' ? styles.colorPink :
                                          color === '#06b6d4' ? styles.colorCyan :
                                            color === '#f97316' ? styles.colorOrange :
                                              '')
                            }
                            aria-label={`Select color ${color}`}
                            title={`Select color ${color}`}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Submit */}
                <div className="flex flex-wrap gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isUpdatingFriend}
                    className="flex-1 bg-black hover:bg-gray-900 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors shadow-lg min-w-[160px]"
                    aria-label={editingFriendId ? 'Save Friend Changes' : 'Add Friend'}
                    title={editingFriendId ? 'Save Friend Changes' : 'Add Friend'}
                  >
                    {editingFriendId ? 'Save Changes' : 'Add Friend'}
                  </button>

                  {editingFriendId ? (
                    <>
                      <button
                        type="button"
                        onClick={handleDeleteSavedFriend}
                        disabled={isDeletingFriend || isUpdatingFriend}
                        className="flex-1 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-60 text-red-700 py-3 rounded-xl font-semibold transition-colors min-w-[160px]"
                        aria-label="Delete Friend"
                        title="Delete Friend"
                      >
                        Delete Friend
                      </button>
                      <button
                        type="button"
                        onClick={returnFromEditor}
                        disabled={isDeletingFriend || isUpdatingFriend}
                        className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-700 py-3 rounded-xl font-semibold transition-colors min-w-[160px]"
                        aria-label="Cancel Editing"
                        title="Cancel Editing"
                      >
                        Cancel
                      </button>
                    </>
                  ) : friends.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingFriend(false)}
                      className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-semibold transition-colors"
                      aria-label="Done Adding"
                      title="Done Adding"
                    >
                      Done Adding
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </div>

          {/* Friends List */}
          {friends.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
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
                      className={
                        styles.friendAvatar + ' ' +
                        (friend.color === '#3b82f6' ? styles.colorBlue :
                          friend.color === '#ef4444' ? styles.colorRed :
                            friend.color === '#10b981' ? styles.colorGreen :
                              friend.color === '#f59e0b' ? styles.colorAmber :
                                friend.color === '#8b5cf6' ? styles.colorPurple :
                                  friend.color === '#ec4899' ? styles.colorPink :
                                    friend.color === '#06b6d4' ? styles.colorCyan :
                                      friend.color === '#f97316' ? styles.colorOrange :
                                        '')
                      }
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
                      aria-label="Remove Friend"
                      title="Remove Friend"
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
        {friends.length === 0 && savedFriends.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 max-w-4xl">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">💡 Tip:</span> Add friends here to easily split group expenses and track who owes whom. You can add email addresses or phone numbers to send payment reminders.
            </p>
          </div>
        )}

        {!editingFriendId && savedFriends.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Already Saved ({savedFriends.length})
            </h3>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {savedFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-sm font-bold text-white">
                    {friend.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{friend.name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {friend.email || friend.phone || 'No contact info'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Button */}
        {friends.length > 0 && (
          <div className="flex gap-3 max-w-4xl">
            <button
              onClick={handleSaveFriends}
              className="flex-1 bg-black hover:bg-gray-900 text-white py-3 rounded-xl font-semibold transition-colors shadow-lg"
              aria-label="Save Friends and Continue"
              title="Save Friends and Continue"
            >
              Save Friends & Continue
            </button>
            <button
              onClick={() => setCurrentPage('groups')}
              className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-semibold transition-colors"
              aria-label="Cancel"
              title="Cancel"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </CenteredLayout>
  );
};
