import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { db } from '@/lib/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { ChevronLeft, Users, Calendar, Check, Clock, X } from 'lucide-react';

interface Advisor {
  id: number;
  name: string;
  specialization: string;
  rating: number;
  experience: number;
  hourlyRate: number;
  availability: string[];
}

interface Session {
  id: number;
  advisorId: number;
  advisorName: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string;
}

const ADVISORS: Advisor[] = [
  {
    id: 1,
    name: 'Sarah Johnson',
    specialization: 'Investment Planning',
    rating: 4.8,
    experience: 12,
    hourlyRate: 150,
    availability: ['Mon', 'Wed', 'Fri'],
  },
  {
    id: 2,
    name: 'Raj Patel',
    specialization: 'Retirement Planning',
    rating: 4.9,
    experience: 15,
    hourlyRate: 180,
    availability: ['Tue', 'Thu', 'Sat'],
  },
  {
    id: 3,
    name: 'Emma Davis',
    specialization: 'Debt Management',
    rating: 4.7,
    experience: 8,
    hourlyRate: 120,
    availability: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  {
    id: 4,
    name: 'Michael Chen',
    specialization: 'Tax Planning',
    rating: 4.9,
    experience: 20,
    hourlyRate: 200,
    availability: ['Tue', 'Wed', 'Thu'],
  },
];

export const FinanceAdvisor: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { currency, setCurrentPage } = useApp();
  const [activeTab, setActiveTab] = useState<'browse' | 'sessions'>('browse');
  const [selectedAdvisor, setSelectedAdvisor] = useState<Advisor | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '10:00',
    duration: 1,
    type: 'consultation',
    notes: '',
  });

  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('advisorSessions');
    return saved ? JSON.parse(saved) : [];
  });

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setCurrentPage('settings');
    }
  };

  const handleBookSession = async () => {
    if (!selectedAdvisor || !bookingData.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newSession: Session = {
      id: Date.now(),
      advisorId: selectedAdvisor.id,
      advisorName: selectedAdvisor.name,
      date: bookingData.date,
      time: bookingData.time,
      duration: bookingData.duration,
      type: bookingData.type,
      status: 'scheduled',
      notes: bookingData.notes,
    };

    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);
    localStorage.setItem('advisorSessions', JSON.stringify(updatedSessions));

    toast.success(`Session booked with ${selectedAdvisor.name}`);
    setShowBooking(false);
    setSelectedAdvisor(null);
    setBookingData({
      date: '',
      time: '10:00',
      duration: 1,
      type: 'consultation',
      notes: '',
    });
  };

  const handleCancelSession = (sessionId: number) => {
    const updatedSessions = sessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'cancelled' as const } : s
    );
    setSessions(updatedSessions);
    localStorage.setItem('advisorSessions', JSON.stringify(updatedSessions));
    toast.success('Session cancelled');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled');
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  return (
    <CenteredLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Finance Advisor
          </h2>
          <p className="text-gray-500 mt-1">Get professional financial guidance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => { setActiveTab('browse'); setShowBooking(false); }}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'browse'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Browse Advisors
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          My Sessions {upcomingSessions.length > 0 && `(${upcomingSessions.length})`}
        </button>
      </div>

      {/* Browse Advisors Tab */}
      {activeTab === 'browse' && (
        <div className="space-y-6">
          {!showBooking ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ADVISORS.map((advisor) => (
                  <div
                    key={advisor.id}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{advisor.name}</h3>
                        <p className="text-sm text-blue-600 font-medium">{advisor.specialization}</p>
                      </div>
                      <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
                        <span className="text-lg">⭐</span>
                        <span className="font-semibold text-gray-900">{advisor.rating}</span>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar size={16} />
                        <span className="text-sm">{advisor.experience} years experience</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(advisor.hourlyRate)}/hr
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Available:</p>
                        <div className="flex flex-wrap gap-2">
                          {advisor.availability.map((day) => (
                            <span
                              key={day}
                              className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full"
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedAdvisor(advisor);
                        setShowBooking(true);
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Book Session
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Booking Form */
            <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl">
              <div className="mb-6">
                <button
                  onClick={() => {
                    setShowBooking(false);
                    setSelectedAdvisor(null);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  ← Back to Advisors
                </button>
                <h3 className="text-xl font-bold text-gray-900 mt-4">
                  Book Session with {selectedAdvisor?.name}
                </h3>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleBookSession(); }} className="space-y-6">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Date *
                  </label>
                  <input
                    type="date"
                    value={bookingData.date}
                    onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Time
                  </label>
                  <input
                    type="time"
                    value={bookingData.time}
                    onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Duration (hours)
                  </label>
                  <select
                    value={bookingData.duration}
                    onChange={(e) => setBookingData({ ...bookingData, duration: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 hour</option>
                    <option value={2}>2 hours</option>
                    <option value={3}>3 hours</option>
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Type
                  </label>
                  <select
                    value={bookingData.type}
                    onChange={(e) => setBookingData({ ...bookingData, type: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="planning">Financial Planning</option>
                    <option value="review">Portfolio Review</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={bookingData.notes}
                    onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                    placeholder="Tell the advisor about your financial goals..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={4}
                  />
                </div>

                {/* Cost Summary */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Estimated Cost:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {formatCurrency((selectedAdvisor?.hourlyRate || 0) * bookingData.duration)}
                    </span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBooking(false);
                      setSelectedAdvisor(null);
                    }}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Confirm Booking
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* My Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* Upcoming Sessions */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-blue-600" />
              Upcoming Sessions
            </h3>
            {upcomingSessions.length > 0 ? (
              <div className="space-y-4">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-white rounded-xl border border-gray-200 p-6 flex justify-between items-start"
                  >
                    <div>
                      <h4 className="font-bold text-gray-900">{session.advisorName}</h4>
                      <p className="text-sm text-gray-600">{session.type}</p>
                      <div className="flex gap-4 mt-3 text-sm text-gray-600">
                        <span>📅 {new Date(session.date).toLocaleDateString()}</span>
                        <span>🕐 {session.time}</span>
                        <span>⏱️ {session.duration}h</span>
                      </div>
                      {session.notes && <p className="text-sm text-gray-500 mt-2">📝 {session.notes}</p>}
                    </div>
                    <button
                      onClick={() => handleCancelSession(session.id)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium flex items-center gap-2"
                    >
                      <X size={16} /> Cancel
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-600">
                No upcoming sessions. Book one now!
              </div>
            )}
          </div>

          {/* Completed Sessions */}
          {completedSessions.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Check size={20} className="text-green-600" />
                Completed Sessions
              </h3>
              <div className="space-y-4">
                {completedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-green-50 rounded-xl border border-green-200 p-6 opacity-75"
                  >
                    <h4 className="font-bold text-gray-900">{session.advisorName}</h4>
                    <p className="text-sm text-gray-600">{session.type}</p>
                    <div className="flex gap-4 mt-3 text-sm text-gray-600">
                      <span>📅 {new Date(session.date).toLocaleDateString()}</span>
                      <span>🕐 {session.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </CenteredLayout>
  );
};
