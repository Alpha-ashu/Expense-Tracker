import React, { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SearchableDropdown } from '@/app/components/ui/SearchableDropdown';
import { backendService } from '@/lib/backend-api';
import { Users, UserPlus, X, ChevronLeft, Loader2, Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const RELATIONSHIPS = ['friend', 'family', 'colleague', 'roommate', 'partner', 'other'];

const relationshipOptions = RELATIONSHIPS.map((relationship) => ({
  value: relationship,
  label: relationship.charAt(0).toUpperCase() + relationship.slice(1),
  description: relationship === 'other' ? 'Custom contact relationship' : `Mark as ${relationship}`,
  group: 'Relationship',
}));

export const AddFriends: React.FC = () => {
  const { setCurrentPage, refreshData, friends } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queue, setQueue] = useState<{ name: string; email: string; phone: string; relationship: string }[]>([]);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', relationship: 'friend' });

  const addToQueue = () => {
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    if (queue.some((q) => q.name.toLowerCase() === formData.name.trim().toLowerCase())) { toast.error('Already in queue'); return; }
    setQueue([...queue, { ...formData, name: formData.name.trim() }]);
    setFormData({ name: '', email: '', phone: '', relationship: 'friend' });
  };

  const removeFromQueue = (i: number) => setQueue(queue.filter((_, idx) => idx !== i));

  const handleSaveAll = async () => {
    if (queue.length === 0) { toast.error('Add at least one friend'); return; }
    setIsSubmitting(true);
    try {
      for (const friend of queue) {
        const now = new Date();
        const id = await db.friends.add({ name: friend.name, email: friend.email || undefined, phone: friend.phone || undefined, relationship: friend.relationship, createdAt: now, updatedAt: now } as any);
        try { await backendService.createFriend({ name: friend.name, email: friend.email || undefined, phone: friend.phone || undefined, createdAt: now, updatedAt: now }); } catch {}
      }
      toast.success(`${queue.length} friend${queue.length > 1 ? 's' : ''} added!`);
      setQueue([]);
      refreshData();
      setCurrentPage('friends');
    } catch (error) {
      console.error('Failed to save friends:', error);
      toast.error('Failed to save friends');
    } finally { setIsSubmitting(false); }
  };

  return (
    <>
      <div className="lg:hidden w-full min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eef2ff_28%,#f8fafc_56%,#f8fafc_100%)] py-4 lg:py-7 font-sans">
        <CenteredLayout>
          <div className="space-y-6 max-w-lg w-full mx-auto pb-8">
            <PageHeader title="Add Friends" subtitle="Manage your contacts" icon={<UserPlus size={20} />} showBack backTo="friends" />
            <div className="rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., John Doe" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+91..." />
                  </div>
                </div>
                <SearchableDropdown
                  label="Relationship"
                  options={relationshipOptions}
                  value={formData.relationship}
                  onChange={(relationship) => setFormData({ ...formData, relationship })}
                  placeholder="Choose relationship"
                  searchPlaceholder="Search relationship..."
                  grouped
                />
                <button type="button" onClick={addToQueue}
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
                  <UserPlus size={15} /> Add to Queue
                </button>
              </div>
            </div>
            {queue.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">Queue ({queue.length})</p>
                  <button type="button" onClick={handleSaveAll} disabled={isSubmitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-60">
                    {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save All
                  </button>
                </div>
                {queue.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{f.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{f.name}</p>
                      <p className="text-xs text-gray-500 truncate">{[f.email, f.phone].filter(Boolean).join('  ') || f.relationship}</p>
                    </div>
                    <button type="button" onClick={() => removeFromQueue(i)} className="text-gray-400 hover:text-rose-600"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CenteredLayout>
      </div>

      <div className="hidden lg:block w-full min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eef2ff_28%,#f8fafc_56%,#f8fafc_100%)] py-4 lg:py-7 font-sans">
        <div className="w-full max-w-[800px] mx-auto px-8 py-6">
          <div className="mb-6 flex items-center gap-3">
            <button type="button" onClick={() => setCurrentPage('friends')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 shadow-sm"><ChevronLeft size={18} /></button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md"><UserPlus size={16} className="text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Add Friends</h1>
              <p className="text-xs text-gray-500">Manage your contacts for group expenses and loans</p>
            </div>
          </div>

          <div className="rounded-lg p-8 shadow-xl shadow-gray-200/40 border border-gray-100">
            {/* Primary Row */}
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Full Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToQueue())}
                  className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none transition-all placeholder:font-medium placeholder:text-gray-400"
                  placeholder="e.g., John Doe" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-400"
                  placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none placeholder:font-medium placeholder:text-gray-400"
                  placeholder="+91..." />
              </div>
              <SearchableDropdown
                label="Relationship"
                options={relationshipOptions}
                value={formData.relationship}
                onChange={(relationship) => setFormData({ ...formData, relationship })}
                placeholder="Choose relationship"
                searchPlaceholder="Search relationship..."
                grouped
              />
              <div className="col-span-2">
                <button type="button" onClick={addToQueue}
                  className="h-12 w-full px-8 rounded-lg bg-gray-900 text-white font-bold shadow-lg hover:bg-gray-800 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <UserPlus size={16} /> Add
                </button>
              </div>
            </div>

            {/* Queue */}
            {queue.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Queued ({queue.length})</p>
                  <button type="button" onClick={handleSaveAll} disabled={isSubmitting}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:from-blue-700 hover:to-indigo-700 shadow-lg disabled:opacity-60 transition-all">
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save All Friends
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {queue.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">{f.name.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{f.name}</p>
                        <p className="text-xs text-gray-500 truncate">{[f.email, f.phone].filter(Boolean).join('  ') || f.relationship}</p>
                      </div>
                      <button type="button" onClick={() => removeFromQueue(i)} className="text-gray-400 hover:text-rose-600 transition-colors"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saved Contacts */}
            {friends && friends.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Saved Contacts ({friends.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {friends.slice(0, 12).map((f) => (
                    <div key={f.id} className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">{f.name.charAt(0).toUpperCase()}</div>
                      <span className="text-sm font-medium text-gray-700 truncate">{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
