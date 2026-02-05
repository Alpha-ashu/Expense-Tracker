import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Share2, Archive, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export const ToDoLists: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');

  // Get current user (simplified - in real app would use auth context)
  const currentUserId = 'user-1'; // Placeholder

  const toDoLists = useLiveQuery(
    () => db.toDoLists.where('ownerId').equals(currentUserId).toArray(),
    [currentUserId]
  ) || [];

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error('List name is required');
      return;
    }

    try {
      const listId = await db.toDoLists.add({
        name: newListName,
        description: newListDescription || undefined,
        ownerId: currentUserId,
        createdAt: new Date(),
        archived: false,
      });

      toast.success('To-Do List created successfully');
      setNewListName('');
      setNewListDescription('');
      setShowCreateModal(false);

      // Navigate to the newly created list
      localStorage.setItem('viewingToDoListId', listId.toString());
      setCurrentPage('todo-list-detail');
    } catch (error) {
      console.error('Failed to create list:', error);
      toast.error('Failed to create list');
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (confirm('Are you sure you want to delete this list? This action cannot be undone.')) {
      try {
        await db.toDoLists.delete(listId);
        // Also delete items and shares
        await db.toDoItems.where('listId').equals(listId).delete();
        await db.toDoListShares.where('listId').equals(listId).delete();
        toast.success('List deleted successfully');
      } catch (error) {
        console.error('Failed to delete list:', error);
        toast.error('Failed to delete list');
      }
    }
  };

  const handleOpenList = (listId: number) => {
    localStorage.setItem('viewingToDoListId', listId.toString());
    setCurrentPage('todo-list-detail');
  };

  const handleShareList = (listId: number) => {
    localStorage.setItem('sharingToDoListId', listId.toString());
    setCurrentPage('todo-list-share');
  };

  const handleArchiveList = async (listId: number) => {
    try {
      const list = await db.toDoLists.get(listId);
      if (list) {
        await db.toDoLists.update(listId, { archived: !list.archived });
        toast.success(list.archived ? 'List unarchived' : 'List archived');
      }
    } catch (error) {
      console.error('Failed to archive list:', error);
      toast.error('Failed to update list');
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">To-Do Lists</h2>
            <p className="text-gray-500 mt-1">Manage your tasks and collaborate with others</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            New List
          </button>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Create New List</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    List Name *
                  </label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g., Weekly Tasks"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="Add a description for this list"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateList}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create List
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lists Grid */}
        {toDoLists.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
            <CheckCircle2 size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No To-Do Lists Yet</h3>
            <p className="text-gray-500 mb-6">Create your first to-do list to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Create First List
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {toDoLists.map((list) => (
              <div
                key={list.id}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{list.name}</h3>
                    {list.description && (
                      <p className="text-sm text-gray-500 mt-1">{list.description}</p>
                    )}
                  </div>
                  {list.archived && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      Archived
                    </span>
                  )}
                </div>

                <div className="text-sm text-gray-500 mb-4">
                  Created {new Date(list.createdAt).toLocaleDateString()}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenList(list.id!)}
                    className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleShareList(list.id!)}
                    title="Share this list"
                    className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Share2 size={18} />
                  </button>
                  <button
                    onClick={() => handleArchiveList(list.id!)}
                    title={list.archived ? 'Unarchive list' : 'Archive list'}
                    className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Archive size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteList(list.id!)}
                    title="Delete list"
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CenteredLayout>
  );
};
