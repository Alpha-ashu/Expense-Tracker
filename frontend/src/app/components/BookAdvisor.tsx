import React, { useState } from 'react';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { ChevronLeft, Star, Calendar, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const MOCK_ADVISORS = [
  {
    id: 'advisor-1',
    name: 'Rajesh Kumar',
    specialty: 'Portfolio Management',
    rating: 4.8,
    reviews: 125,
    hourlyRate: 500,
    availability: 'Available Today',
  },
  {
    id: 'advisor-2',
    name: 'Priya Sharma',
    specialty: 'Tax Planning',
    rating: 4.9,
    reviews: 98,
    hourlyRate: 450,
    availability: 'Available Tomorrow',
  },
  {
    id: 'advisor-3',
    name: 'Amit Patel',
    specialty: 'Wealth Management',
    rating: 4.7,
    reviews: 156,
    hourlyRate: 600,
    availability: 'Available in 2 hours',
  },
];

interface BookingForm {
  advisorId: string;
  topic?: string;
  message?: string;
  sessionType: 'video' | 'audio' | 'chat';
  preferredTime?: string;
}

export const BookAdvisor: React.FC = () => {
  const { setCurrentPage } = useApp();
  const { user, role } = useAuth();
  const [selectedAdvisor, setSelectedAdvisor] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    advisorId: '',
    sessionType: 'video',
    topic: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query existing booking requests from current user
  const userBookings = useLiveQuery(
    () => db.bookingRequests.where('userId').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const handleSelectAdvisor = (advisorId: string) => {
    setSelectedAdvisor(advisorId);
    setBookingForm((prev) => ({
      ...prev,
      advisorId,
    }));
  };

  const handleSubmitBooking = async () => {
    if (!bookingForm.advisorId || !user) {
      toast.error('Please select an advisor');
      return;
    }

    setIsSubmitting(true);

    try {
      const advisor = MOCK_ADVISORS.find((a) => a.id === bookingForm.advisorId);
      const nextSequence = Math.max(...userBookings.map((b) => b.sequenceNumber || 0), 0) + 1;

      await db.bookingRequests.add({
        advisorId: bookingForm.advisorId,
        userId: user.id,
        advisorName: advisor?.name || 'Unknown',
        userEmail: user.email || 'unknown@example.com',
        topic: bookingForm.topic,
        message: bookingForm.message,
        sessionType: bookingForm.sessionType,
        preferredTime: bookingForm.preferredTime,
        status: 'pending',
        createdAt: new Date(),
        sequenceNumber: nextSequence,
      });

      toast.success('Booking request sent! The advisor will respond soon.');
      setSelectedAdvisor(null);
      setBookingForm({
        advisorId: '',
        sessionType: 'video',
        topic: '',
        message: '',
      });
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to send booking request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Book a Financial Advisor</h2>
            <p className="text-gray-500 mt-1">Get expert guidance for your finances</p>
          </div>
        </div>

        {/* My Active Bookings */}
        {userBookings.filter((b) => b.status !== 'rejected').length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Your Active Bookings</h3>
            <div className="space-y-2">
              {userBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between text-sm text-blue-800 bg-white rounded px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{booking.advisorName}</p>
                    <p className="text-xs text-blue-600">{booking.status}</p>
                  </div>
                  <span className="text-xs font-medium">
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advisors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MOCK_ADVISORS.map((advisor) => (
            <div
              key={advisor.id}
              className={`rounded-lg border p-6 transition-all cursor-pointer ${
                selectedAdvisor === advisor.id
                  ? 'border-blue-500 bg-blue-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:shadow-md'
              }`}
              onClick={() => handleSelectAdvisor(advisor.id)}
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{advisor.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{advisor.specialty}</p>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <Star size={16} className="text-yellow-500" />
                  <span className="font-medium">{advisor.rating}</span>
                  <span className="text-gray-500">({advisor.reviews} reviews)</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock size={16} />
                  <span>{advisor.availability}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="font-medium">₹{advisor.hourlyRate}/hour</span>
                </div>
              </div>

              {selectedAdvisor === advisor.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAdvisor(null);
                  }}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Selected ✓
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Booking Form */}
        {selectedAdvisor && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Booking Details</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['video', 'audio', 'chat'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setBookingForm((prev) => ({
                        ...prev,
                        sessionType: type,
                      }))
                    }
                    className={`p-3 rounded-lg border font-medium transition-all ${
                      bookingForm.sessionType === type
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {type === 'video' && '🎥 Video'}
                    {type === 'audio' && '☎️ Audio'}
                    {type === 'chat' && '💬 Chat'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic (Optional)
              </label>
              <input
                type="text"
                value={bookingForm.topic || ''}
                onChange={(e) =>
                  setBookingForm((prev) => ({
                    ...prev,
                    topic: e.target.value,
                  }))
                }
                placeholder="e.g., Portfolio Review, Tax Planning"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message (Optional)
              </label>
              <textarea
                value={bookingForm.message || ''}
                onChange={(e) =>
                  setBookingForm((prev) => ({
                    ...prev,
                    message: e.target.value,
                  }))
                }
                placeholder="Tell the advisor about your situation..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedAdvisor(null)}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitBooking}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium transition-colors"
              >
                {isSubmitting ? 'Sending...' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </CenteredLayout>
  );
};
