import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { backendService } from '@/lib/backend-api';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { Users, UserPlus, X, Check, ChevronLeft, Loader2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const GROUP_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'food', label: 'Food & Dining' },
  { value: 'travel', label: 'Travel' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
];

export const AddGroup: React.FC = () => {
  const { setCurrentPage, currency, friends, refreshData } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    participants: [''] as string[],
    totalAmount: '',
    category: 'general',
    date: new Date().toISOString().split('T')[0],
  });

  const validParticipants = formData.participants.filter((p) => p.trim());
  const totalNum = parseFloat(formData.totalAmount) || 0;
  const perPerson = validParticipants.length > 0 ? totalNum / (validParticipants.length + 1) : 0;
  const fmt = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v);

  const addParticipant = () => setFormData({ ...formData, participants: [...formData.participants, ''] });
  const removeParticipant = (i: number) => setFormData({ ...formData, participants: formData.participants.filter((_, idx) => idx !== i) });
  const updateParticipant = (i: number, val: string) => {
    const next = [...formData.participants];
    next[i] = val;
    setFormData({ ...formData, participants: next });
  };
  const addFriend = (name: string) => {
    if (formData.participants.some((p) => p.toLowerCase() === name.toLowerCase())) { toast.error(`${name} already added`); return; }
    const emptyIdx = formData.participants.findIndex((p) => !p.trim());
    if (emptyIdx !== -1) { const next = [...formData.participants]; next[emptyIdx] = name; setFormData({ ...formData, participants: next }); }
    else { setFormData({ ...formData, participants: [...formData.participants, name] }); }
    setShowFriendPicker(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validParticipants.length < 1) { toast.error('Add at least one participant'); return; }
    if (totalNum <= 0) { toast.error('Total amount must be greater than 0'); return; }
    setIsSubmitting(true);
    try {
      await backendService.createGroup({
        id: Date.now().toString(), name: formData.name, members: validParticipants,
        createdAt: new Date(), description: formData.description, totalAmount: totalNum,
        amountPerPerson: perPerson, category: formData.category, date: new Date(formData.date),
      });
      toast.success('Group expense created!');
      refreshData();
      setCurrentPage('groups');
    } catch (error) {
      console.error('Failed to create group:', error);
      toast.error('Failed to create group expense');
    } finally { setIsSubmitting(false); }
  };

  const selectStyle = { backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' };

  /*  Participants section (shared)  */
  const participantsSection = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Participants <span className="text-gray-300 font-normal normal-case tracking-normal">(you are always included)</span></p>
        <div className="flex gap-2">
          {friends && friends.length > 0 && (
            <button type="button" onClick={() => setShowFriendPicker(!showFriendPicker)}
              className="text-xs bg-violet-50 text-violet-600 px-3 py-1.5 rounded-lg hover:bg-violet-100 transition-colors flex items-center gap-1 font-semibold">
              <UserPlus size={13} /> From Friends
            </button>
          )}
          <button type="button" onClick={addParticipant} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors font-semibold">+ Add</button>
        </div>
      </div>
      {showFriendPicker && friends.length > 0 && (
        <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-violet-800">Select:</span>
            <button type="button" onClick={() => setShowFriendPicker(false)} className="text-violet-600 hover:text-violet-800"><X size={14} /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => {
              const added = formData.participants.some((p) => p.toLowerCase() === f.name.toLowerCase());
              return (
                <button key={f.id} type="button" onClick={() => !added && addFriend(f.name)} disabled={added}
                  className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition-all', added ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border border-violet-300 text-violet-800 hover:bg-violet-100')}>
                  {added && <Check size={10} className="inline mr-1" />}{f.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="space-y-2">
        {formData.participants.map((p, i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">{p ? p.charAt(0).toUpperCase() : (i + 1)}</div>
            <input type="text" value={p} onChange={(e) => updateParticipant(i, e.target.value)} placeholder={`Participant ${i + 1}`}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-violet-400 focus:border-violet-400 focus:bg-white outline-none" />
            {formData.participants.length > 1 && (
              <button type="button" onClick={() => removeParticipant(i)} className="text-gray-400 hover:text-rose-600 transition-colors"><X size={14} /></button>
            )}
          </div>
        ))}
      </div>
      {totalNum > 0 && validParticipants.length > 0 && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-violet-700"><Calculator size={12} className="inline mr-1" /> Per person ({validParticipants.length + 1} people)</span>
          <span className="text-sm font-bold text-violet-900">{fmt(perPerson)}</span>
        </div>
      )}
    </div>
  );

  const [isDesktop, setIsDesktop] = useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  return (
    <>
      {isDesktop ? (
        
        <div className="block">
          <div className="w-full max-w-6xl mx-auto px-8 py-6">
            <div className="mb-6 flex items-center gap-3">
              <button type="button" onClick={() => setCurrentPage('groups')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 shadow-sm"><ChevronLeft size={18} /></button>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md"><Users size={16} className="text-white" /></div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Create Group Expense</h1>
                <p className="text-xs text-gray-500">Split expenses with friends and track who owes what</p>
              </div>
            </div>

            <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-gray-200/40 border border-gray-100">
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* Primary Row */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Group Name</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none transition-all placeholder:font-medium placeholder:text-gray-400"
                      placeholder="e.g., Goa Trip, Dinner" required />
                  </div>
                  <div className="w-[200px] shrink-0">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Total Amount</label>
                    <div className="flex items-center bg-gray-50 border border-gray-200 focus-within:ring-2 focus-within:ring-violet-500 rounded-2xl px-4 py-4 transition-all">
                      <span className="text-gray-500 font-bold mr-2">{currency}</span>
                      <input type="number" step="0.01" min="0" value={formData.totalAmount} onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                        className="w-full bg-transparent text-xl font-bold text-gray-900 outline-none placeholder:text-gray-300" placeholder="0.00" />
                    </div>
                  </div>
                  <div className="w-[160px] shrink-0">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Category</label>
                    <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-violet-500 rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none appearance-none cursor-pointer" style={selectStyle}>
                        {GROUP_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                  </div>
                  <div className="w-[140px] shrink-0">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 ml-1">Date</label>
                    <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-violet-500 rounded-2xl py-4 px-4 text-sm font-bold text-gray-900 outline-none" />
                  </div>
                  <div className="shrink-0">
                    <button type="submit" disabled={isSubmitting}
                      className="h-14 px-8 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-lg hover:from-violet-700 hover:to-purple-700 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
                      {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Users size={16} /> Create</>}
                    </button>
                  </div>
                </div>

                {/* Participants Row */}
                <div className="border-t border-gray-100 pt-6">
                  {participantsSection}
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-white flex flex-col pb-[100px]">
          <div className="flex flex-col pt-12 pb-6 px-6 relative z-10">
            <button 
              type="button"
              onClick={() => setCurrentPage('groups')}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 mb-6 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <span className="text-4xl text-violet-600"><Users /></span> Group Expense
            </h1>
            <p className="text-sm text-gray-500 mt-2">Split expenses with friends</p>
          </div>

          <div className="px-6 flex-1">
            <div className="bg-white rounded-[32px] p-6 ring-1 ring-gray-100 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.05)]">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Group Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-50 border-0 rounded-2xl px-4 py-3.5 text-gray-900 font-medium text-lg placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all" placeholder="e.g., Goa Trip" required />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Total Amount</label>
                  <div className="flex items-center bg-gray-50 rounded-2xl px-4 py-3.5 focus-within:ring-2 focus-within:ring-violet-500 focus-within:bg-white transition-all">
                    <span className="text-gray-500 text-lg font-bold mr-2">{currency}</span>
                    <input type="number" step="0.01" min="0" value={formData.totalAmount} onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                      className="flex-1 bg-transparent text-lg font-bold text-gray-900 focus:outline-none" placeholder="0.00" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Date</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-gray-50 border-0 rounded-2xl px-4 py-3.5 text-gray-900 font-medium focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all" />
                </div>

                <div className="pt-2 border-t border-gray-100">
                  {participantsSection}
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold shadow-lg hover:from-violet-700 hover:to-purple-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Users size={16} /> Create Group Expense</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
