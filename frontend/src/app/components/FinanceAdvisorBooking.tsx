import React, { useState } from 'react';
import { db } from '../../lib/database';
import { toast } from 'sonner';
import { Users, Star, Clock, DollarSign, Video, Phone, MessageCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { AdvisorSession } from '../../lib/database';

interface FinanceAdvisorBookingProps {
  isOpen: boolean;
  onClose: () => void;
  currency: string;
}

export const FinanceAdvisorBooking: React.FC<FinanceAdvisorBookingProps> = ({
  isOpen,
  onClose,
  currency,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'sessions'>('browse');
  const [selectedAdvisor, setSelectedAdvisor] = useState<number | null>(null);
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    duration: 60,
    type: 'video' as 'video' | 'audio' | 'chat',
    notes: '',
  });

  const allAdvisors = useLiveQuery(() => db.financeAdvisors.toArray(), []) || [];
  const advisors = allAdvisors.filter((a) => a.verified);
  const sessions = useLiveQuery(
    () => db.advisorSessions.where('status').notEqual('cancelled').toArray(),
    []
  ) || [];

  // Mock advisors for demo
  const mockAdvisors = [
    {
      id: 1,
      name: 'Rajesh Kumar',
      email: 'rajesh@advisor.com',
      phone: '+91-9876543210',
      specialization: ['Tax Planning', 'Investment', 'Retirement'],
      qualifications: ['CA', 'CFA', 'MBA'],
      experience: 15,
      rating: 4.8,
      availability: ['Mon', 'Wed', 'Fri', 'Sat'],
      hourlyRate: 2000,
      bio: 'Expert in personal finance and tax optimization',
      verified: true,
    },
    {
      id: 2,
      name: 'Priya Sharma',
      email: 'priya@advisor.com',
      phone: '+91-9876543211',
      specialization: ['Wealth Management', 'Stock Market', 'Real Estate'],
      qualifications: ['SEBI', 'CFP', 'MBA Finance'],
      experience: 12,
      rating: 4.9,
      availability: ['Tue', 'Thu', 'Sat', 'Sun'],
      hourlyRate: 2500,
      bio: 'Specializing in wealth creation and portfolio management',
      verified: true,
    },
    {
      id: 3,
      name: 'Amit Patel',
      email: 'amit@advisor.com',
      phone: '+91-9876543212',
      specialization: ['Business Finance', 'GST', 'Compliance'],
      qualifications: ['CA', 'CS', 'B.Com'],
      experience: 18,
      rating: 4.7,
      availability: ['Mon', 'Tue', 'Wed', 'Thu'],
      hourlyRate: 3000,
      bio: 'Expert in business financial planning and compliance',
      verified: true,
    },
    {
      id: 4,
      name: 'Neha Singh',
      email: 'neha@advisor.com',
      phone: '+91-9876543213',
      specialization: ['Insurance Planning', 'Mutual Funds', 'Budgeting'],
      qualifications: ['CFP', 'ELSS Specialist'],
      experience: 10,
      rating: 4.6,
      availability: ['Mon', 'Wed', 'Fri', 'Sat', 'Sun'],
      hourlyRate: 1500,
      bio: 'Helping families build financial security',
      verified: true,
    },
  ];

  const handleBooking = async () => {
    if (!selectedAdvisor || !bookingData.date || !bookingData.time) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const advisor = mockAdvisors.find((a) => a.id === selectedAdvisor);
      if (!advisor) return;

      const sessionDate = new Date(`${bookingData.date}T${bookingData.time}`);

      await db.advisorSessions.add({
        advisorId: selectedAdvisor,
        date: sessionDate,
        duration: bookingData.duration,
        type: bookingData.type,
        status: 'scheduled',
        notes: bookingData.notes,
        amount: (advisor.hourlyRate * bookingData.duration) / 60,
        createdAt: new Date(),
      });

      toast.success(`Session booked with ${advisor.name}`);
      setSelectedAdvisor(null);
      setBookingData({
        date: '',
        time: '',
        duration: 60,
        type: 'video',
        notes: '',
      });
    } catch (error) {
      console.error('Booking failed:', error);
      toast.error('Failed to book session');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl my-8">
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-blue-600" size={24} />
          <h3 className="text-2xl font-bold">Finance Advisor</h3>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'browse'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Browse Advisors
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'sessions'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Sessions ({sessions.length})
          </button>
        </div>

        {/* Browse Advisors Tab */}
        {activeTab === 'browse' && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {selectedAdvisor ? (
              // Booking Form
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold">
                  Book Session with{' '}
                  {mockAdvisors.find((a) => a.id === selectedAdvisor)?.name}
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={bookingData.date}
                    onChange={(e) =>
                      setBookingData({ ...bookingData, date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={bookingData.time}
                    onChange={(e) =>
                      setBookingData({ ...bookingData, time: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <select
                    value={bookingData.duration}
                    onChange={(e) =>
                      setBookingData({
                        ...bookingData,
                        duration: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>120 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Type
                  </label>
                  <div className="flex gap-4">
                    {[
                      { value: 'video', icon: Video, label: 'Video' },
                      { value: 'audio', icon: Phone, label: 'Audio' },
                      { value: 'chat', icon: MessageCircle, label: 'Chat' },
                    ].map(({ value, icon: Icon, label }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={value}
                          checked={bookingData.type === value}
                          onChange={(e) =>
                            setBookingData({ ...bookingData, type: e.target.value as any })
                          }
                          className="mr-1"
                        />
                        <Icon size={16} className="text-gray-600" />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={bookingData.notes}
                    onChange={(e) =>
                      setBookingData({ ...bookingData, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="What would you like to discuss?"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedAdvisor(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleBooking}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Confirm Booking
                  </button>
                </div>
              </div>
            ) : (
              // Advisors List
              mockAdvisors.map((advisor) => (
                <div
                  key={advisor.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{advisor.name}</h4>
                      <p className="text-sm text-gray-600">{advisor.bio}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="text-yellow-400 fill-current" size={16} />
                      <span className="text-sm font-medium">{advisor.rating}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Clock size={14} />
                      {advisor.experience} yrs exp.
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <DollarSign size={14} />
                      {currency} {advisor.hourlyRate}/hr
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">Specializations:</p>
                    <div className="flex flex-wrap gap-1">
                      {advisor.specialization.map((spec) => (
                        <span
                          key={spec}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedAdvisor(advisor.id)}
                    className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Book Session
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* My Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No sessions booked yet</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900">Session</h4>
                    <span
                      className={`px-3 py-1 text-xs rounded-full ${
                        session.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-700'
                          : session.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Date: {new Date(session.date).toLocaleDateString()}</p>
                    <p>Duration: {session.duration} minutes</p>
                    <p>Type: {session.type}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Close Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
