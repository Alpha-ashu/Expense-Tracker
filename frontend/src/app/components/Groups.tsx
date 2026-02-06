import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { Plus, Users, DollarSign, Trash2, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/app/components/DeleteConfirmModal';

export const Groups: React.FC = () => {
  const { groupExpenses, accounts, currency, setCurrentPage } = useApp();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleDeleteGroup = (groupId: number, groupName: string) => {
    setGroupToDelete({ id: groupId, name: groupName });
    setDeleteModalOpen(true);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeleting(true);
    try {
      await db.groupExpenses.delete(groupToDelete.id);
      toast.success('Group expense deleted successfully');
      setDeleteModalOpen(false);
      setGroupToDelete(null);
    } catch (error) {
      console.error('Failed to delete group expense:', error);
      toast.error('Failed to delete group expense');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (groupId: number, groupName: string) => {
    setEditingGroupId(groupId);
    setEditedName(groupName);
  };

  const handleSaveEdit = async (groupId: number) => {
    if (!editedName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }
    setIsSaving(true);
    try {
      await db.groupExpenses.update(groupId, { name: editedName });
      toast.success('Group name updated successfully');
      setEditingGroupId(null);
    } catch (error) {
      console.error('Failed to update group:', error);
      toast.error('Failed to update group name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleMemberPayment = async (groupId: number, memberIndex: number, paid: boolean) => {
    try {
      const group = groupExpenses.find(g => g.id === groupId);
      if (!group) return;
      
      const updatedMembers = [...group.members];
      updatedMembers[memberIndex] = { ...updatedMembers[memberIndex], paid: !paid };
      
      await db.groupExpenses.update(groupId, { members: updatedMembers });
      toast.success(`Member marked as ${!paid ? 'paid' : 'pending'}`);
    } catch (error) {
      console.error('Failed to update member payment:', error);
      toast.error('Failed to update member status');
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Group Expenses</h2>
            <p className="text-gray-500 mt-1">Split bills fairly with friends</p>
          </div>
        <button
          onClick={() => setCurrentPage('add-group')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Group Expense
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {groupExpenses.map(expense => {
          const totalPaid = expense.members.filter(m => m.paid).reduce((sum, m) => sum + m.share, 0);
          const totalUnpaid = expense.totalAmount - totalPaid;

          return (
            <div key={expense.id} className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {editingGroupId === expense.id ? (
                    <div className="flex gap-2 items-center mb-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="flex-1 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold"
                      />
                      <button
                        onClick={() => handleSaveEdit(expense.id!)}
                        disabled={isSaving}
                        className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                        title="Save"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => setEditingGroupId(null)}
                        disabled={isSaving}
                        className="p-1.5 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                        title="Cancel"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{expense.name}</h3>
                      <button
                        onClick={() => handleEditClick(expense.id!, expense.name)}
                        className="p-1 hover:bg-blue-100 rounded transition-colors text-blue-600"
                        title="Edit group name"
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-gray-500">{new Date(expense.date).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => handleDeleteGroup(expense.id!, expense.name)}
                  className="p-1 hover:bg-red-100 rounded transition-colors text-red-600"
                  title="Delete group"
                >
                  <Trash2 size={16} />
                </button>
                <div className="text-right ml-4">
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(expense.totalAmount)}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Payment Progress</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(totalPaid)} / {formatCurrency(expense.totalAmount)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(totalPaid / expense.totalAmount) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Members & Shares</p>
                {expense.members.map((member, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleToggleMemberPayment(expense.id!, idx, member.paid)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                    title="Click to toggle payment status"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        member.paid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className={`text-xs ${member.paid ? 'text-green-600' : 'text-orange-600'}`}>
                          {member.paid ? '✓ Paid' : '⏱ Pending'}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">{formatCurrency(member.share)}</p>
                  </button>
                ))}
              </div>

              {expense.items && expense.items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                  {expense.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {groupExpenses.length === 0 && (
        <div className="bg-white p-12 rounded-xl border-2 border-dashed border-gray-300 text-center">
          <Users className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No group expenses yet</h3>
          <p className="text-gray-500 mb-4">Start splitting bills with friends</p>
          <button
            onClick={() => setCurrentPage('add-group')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Group Expense
          </button>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Group Expense"
        message="This group expense will be permanently deleted. All payment records will be lost."
        itemName={groupToDelete?.name}
        isLoading={isDeleting}
        onConfirm={confirmDeleteGroup}
        onCancel={() => {
          setDeleteModalOpen(false);
          setGroupToDelete(null);
        }}
      />

      </div>
    </CenteredLayout>
  );
};
