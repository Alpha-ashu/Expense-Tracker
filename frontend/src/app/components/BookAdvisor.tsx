import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { backendService } from '@/lib/backend-api';
import {
  Star, Calendar, Clock, MessageSquare, Briefcase, Award, Users,
  CheckCircle, XCircle, AlertCircle, Loader2, ChevronLeft, Search,
  Video, Phone, MessageCircle, ArrowRight, RefreshCw, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Advisor {
  id: string;
  name: string;
  email: string;
  averageRating: number;
  reviewCount: number;
  availability: boolean;
  advisorAvailability: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>;
}

interface Booking {
  id: string;
  status: string;
  advisorId: string;
  proposedDate: string;
  proposedTime: string;
  sessionType: string;
  description: string;
  amount: number;
  advisor?: { name: string; email: string };
}

type SessionType = 'video' | 'audio' | 'chat';

const SESSION_TYPES: { id: SessionType; label: string; icon: React.ElementType }[] = [
  { id: 'video', label: 'Video Call', icon: Video },
  { id: 'audio', label: 'Audio Call', icon: Phone },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getStatusBadge(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    pending:    { color: 'bg-amber-50 text-amber-700 border border-amber-200', label: '⏳ Awaiting Approval' },
    accepted:   { color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: '✅ Confirmed' },
    rejected:   { color: 'bg-red-50 text-red-600 border border-red-200', label: '❌ Declined' },
    reschedule: { color: 'bg-blue-50 text-blue-700 border border-blue-200', label: '🔄 Reschedule Proposed' },
    cancelled:  { color: 'bg-gray-100 text-gray-500 border border-gray-200', label: '🚫 Cancelled' },
    completed:  { color: 'bg-slate-100 text-slate-600 border border-slate-200', label: '✔ Completed' },
  };
  const s = map[status] ?? map.pending;
  return <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold', s.color)}>{s.label}</span>;
}

export const BookAdvisor: React.FC = () => {
  const { setCurrentPage } = useApp();
  const { user } = useAuth();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdvisor, setSelectedAdvisor] = useState<Advisor | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyingAsAdvisor, setApplyingAsAdvisor] = useState(false);
  const [form, setForm] = useState({
    sessionType: 'video' as SessionType,
    topic: '',
    message: '',
    preferredDate: '',
    preferredTime: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [advisorRes, bookingRes] = await Promise.allSettled([
        backendService.api.get('/advisors'),
        backendService.api.get('/bookings'),
      ]);
      if (advisorRes.status === 'fulfilled') setAdvisors(Array.isArray(advisorRes.value.data) ? advisorRes.value.data : []);
      if (bookingRes.status === 'fulfilled') setMyBookings(Array.isArray(bookingRes.value.data) ? bookingRes.value.data : []);
    } catch {
      toast.error('Failed to load advisor data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = advisors.filter(a =>
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenBooking = (advisor: Advisor) => {
    setSelectedAdvisor(advisor);
    setForm({ sessionType: 'video', topic: '', message: '', preferredDate: '', preferredTime: '' });
    setShowBookingModal(true);
  };

  const handleSubmitBooking = async () => {
    if (!selectedAdvisor || !form.preferredDate || !form.preferredTime || !form.topic) {
      toast.error('Please fill in topic, date, and time');
      return;
    }
    setIsSubmitting(true);
    try {
      await backendService.api.post('/bookings', {
        advisorId: selectedAdvisor.id,
        sessionType: form.sessionType,
        description: [form.topic, form.message].filter(Boolean).join('\n\n'),
        proposedDate: form.preferredDate,
        proposedTime: form.preferredTime,
        duration: 60,
        amount: 0,
      });
      toast.success('Booking request sent! The advisor will confirm shortly.');
      setShowBookingModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to submit booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyAsAdvisor = async () => {
    setApplyingAsAdvisor(true);
    try {
      await backendService.api.post('/advisors/apply', {});
      toast.success('Application submitted! An admin will review your request.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to submit application');
    } finally {
      setApplyingAsAdvisor(false);
    }
  };

  const clientBookings = myBookings.filter(b => !b.advisorId || b.advisorId !== user?.id);

  return (
    <div className="finora-screen-page finora-advisor-entry min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => setCurrentPage('dashboard')} className="p-2 hover:bg-gray-100 rounded-xl md:hidden transition-colors">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-gray-900">Book a Financial Advisor</h1>
            <p className="text-sm text-gray-500 hidden sm:block">Get expert guidance on your finances</p>
          </div>
          <button onClick={handleApplyAsAdvisor} disabled={applyingAsAdvisor}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all">
            {applyingAsAdvisor ? <Loader2 size={13} className="animate-spin" /> : <Briefcase size={13} />}
            Become an Advisor
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6 space-y-6">

        {/* My Bookings */}
        {clientBookings.length > 0 && (
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">My Bookings</h2>
            <div className="space-y-2">
              {clientBookings.map(b => (
                <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <Briefcase size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{b.description || 'Consultation'}</p>
                    <p className="text-xs text-gray-500">
                      {b.sessionType} · {new Date(b.proposedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} at {b.proposedTime}
                    </p>
                  </div>
                  {getStatusBadge(b.status)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search advisors by name..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm" />
        </div>

        {/* Advisor Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="font-bold text-gray-700">No Advisors Available Yet</h3>
            <p className="text-sm text-gray-500 mt-1 mb-5">Be the first financial advisor on Finora!</p>
            <button onClick={handleApplyAsAdvisor} disabled={applyingAsAdvisor}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700">
              {applyingAsAdvisor ? <Loader2 size={14} className="animate-spin" /> : <Briefcase size={14} />}
              Apply as Advisor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(advisor => (
              <motion.div key={advisor.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 hover:shadow-md transition-all">
                {/* Info */}
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-xl shrink-0">
                    {advisor.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-gray-900">{advisor.name}</h3>
                      {advisor.availability ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Available
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full text-[10px] font-bold">Unavailable</span>
                      )}
                    </div>
                    {advisor.averageRating > 0 && (
                      <span className="flex items-center gap-1 text-sm font-bold text-amber-600">
                        <Star size={13} className="fill-amber-400 text-amber-400" />
                        {advisor.averageRating.toFixed(1)}
                        <span className="text-gray-400 font-normal text-xs ml-0.5">({advisor.reviewCount} reviews)</span>
                      </span>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{advisor.email}</p>
                  </div>
                </div>

                {/* Available Days */}
                {advisor.advisorAvailability?.filter(s => s.isActive).length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map((day, idx) => {
                      const slot = advisor.advisorAvailability.find(s => s.dayOfWeek === idx && s.isActive);
                      return (
                        <span key={day} className={cn('px-2 py-0.5 rounded-lg text-[10px] font-bold',
                          slot ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-gray-200')}>
                          {slot ? day : ''}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Book Button */}
                <button onClick={() => handleOpenBooking(advisor)} disabled={!advisor.availability}
                  className={cn('w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                    advisor.availability
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-lg hover:scale-[1.01] active:scale-100'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
                  {advisor.availability ? <><Calendar size={15} /> Book Session <ArrowRight size={15} /></> : 'Currently Unavailable'}
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Mobile CTA */}
        <div className="sm:hidden">
          <button onClick={handleApplyAsAdvisor} disabled={applyingAsAdvisor}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-all">
            {applyingAsAdvisor ? <Loader2 size={14} className="animate-spin" /> : <Briefcase size={14} />}
            Apply to Become an Advisor
          </button>
        </div>
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {showBookingModal && selectedAdvisor && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black shrink-0">
                  {selectedAdvisor.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">Book: {selectedAdvisor.name}</h3>
                  <p className="text-xs text-gray-500">Session request — advisor will confirm</p>
                </div>
                <button onClick={() => setShowBookingModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <XCircle size={18} className="text-gray-400" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Session Type */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Session Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SESSION_TYPES.map(st => (
                      <button key={st.id} type="button" onClick={() => setForm(f => ({ ...f, sessionType: st.id }))}
                        className={cn('flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all',
                          form.sessionType === st.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-200')}>
                        <st.icon size={18} />
                        <span className="text-[11px] font-bold">{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Topic *</label>
                  <input type="text" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                    placeholder="e.g., Tax planning, Investment review, Debt management"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Date *</label>
                    <input type="date" value={form.preferredDate} min={new Date().toISOString().slice(0, 10)}
                      onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Time *</label>
                    <input type="time" value={form.preferredTime}
                      onChange={e => setForm(f => ({ ...f, preferredTime: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>

                {/* Availability Hint */}
                {selectedAdvisor.advisorAvailability.filter(s => s.isActive).length > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-blue-700 mb-1">Advisor's Available Days:</p>
                    <p className="text-xs text-blue-600">
                      {selectedAdvisor.advisorAvailability.filter(s => s.isActive)
                        .map(s => `${DAYS[s.dayOfWeek]} ${s.startTime}–${s.endTime}`).join(', ')}
                    </p>
                  </div>
                )}

                {/* Message */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Additional Note (optional)</label>
                  <textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Anything specific you'd like to discuss..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                <button onClick={handleSubmitBooking}
                  disabled={isSubmitting || !form.preferredDate || !form.preferredTime || !form.topic}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg transition-all active:scale-[0.98]">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                  Send Booking Request
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
