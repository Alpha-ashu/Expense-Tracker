import React, { useState } from 'react';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, FinanceAdvisor } from '@/lib/database';
import {
  Star,
  Calendar,
  Clock,
  MessageSquare,
  Briefcase,
  Award,
  Users,
  Linkedin,
  Twitter,
  Globe,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface BookingForm {
  advisorId: string;
  topic?: string;
  message?: string;
  sessionType: 'video' | 'audio' | 'chat';
  preferredDate?: string;
  preferredTime?: string;
}

export const BookAdvisor: React.FC = () => {
  const { user, role } = useAuth();
  const [selectedAdvisor, setSelectedAdvisor] = useState<FinanceAdvisor | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    advisorId: '',
    sessionType: 'video',
    topic: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query all available advisors from database
  const advisors = useLiveQuery(
    () => db.financeAdvisors.toArray(),
    []
  ) || [];

  // Query existing booking requests from current user
  const userBookings = useLiveQuery(
    () => db.bookingRequests.where('userId').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  const handleSelectAdvisor = (advisor: FinanceAdvisor) => {
    setSelectedAdvisor(advisor);
    setShowBookingModal(true);
    setBookingForm((prev) => ({
      ...prev,
      advisorId: advisor.userId,
    }));
  };

  const handleSubmitBooking = async () => {
    if (!bookingForm.advisorId || !user || !selectedAdvisor) {
      toast.error('Please complete the booking form');
      return;
    }

    if (!bookingForm.preferredDate || !bookingForm.preferredTime) {
      toast.error('Please select a preferred date and time');
      return;
    }

    setIsSubmitting(true);

    try {
      const nextSequence = Math.max(...userBookings.map((b) => b.sequenceNumber || 0), 0) + 1;
      const bookingId = await db.bookingRequests.add({
        advisorId: bookingForm.advisorId,
        userId: user.id,
        advisorName: selectedAdvisor.name,
        userEmail: user.email || 'unknown@example.com',
        topic: bookingForm.topic,
        message: bookingForm.message,
        sessionType: bookingForm.sessionType,
        preferredTime: `${bookingForm.preferredDate} ${bookingForm.preferredTime}`,
        status: 'pending',
        createdAt: new Date(),
        sequenceNumber: nextSequence,
      });

      // Create notification for advisor with deepLink to workspace
      await db.notifications.add({
        type: 'booking',
        title: 'New Booking Request',
        message: `You have a new booking request from ${user.email}. Session: ${bookingForm.topic || 'Consultation'}`,
        isRead: false,
        userId: bookingForm.advisorId,
        deepLink: '/advisor?booking=' + bookingId,
        createdAt: new Date(),
      });

      toast.success('Booking request sent! The advisor will respond soon.');
      setShowBookingModal(false);
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

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { icon: <AlertCircle size={14} />, text: 'Pending', color: 'text-yellow-600 bg-yellow-50' },
      accepted: { icon: <CheckCircle size={14} />, text: 'Accepted', color: 'text-green-600 bg-green-50' },
      rejected: { icon: <XCircle size={14} />, text: 'Rejected', color: 'text-red-600 bg-red-50' },
      reschedule: { icon: <Clock size={14} />, text: 'Reschedule Requested', color: 'text-blue-600 bg-blue-50' },
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${badge.color}`}>
        {badge.icon}
        {badge.text}
      </span>
    );
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <PageHeader
          title="Book a Financial Advisor"
          subtitle="Connect with verified financial experts"
          icon={<Users size={20} className="sm:w-6 sm:h-6" />}
          showBack
          backTo="dashboard"
        />

        {/* My Active Bookings */}
        {userBookings.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2 text-lg">
              <Calendar size={20} />
              Your Bookings
            </h3>
            <div className="space-y-3">
              {userBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-white rounded-xl px-4 py-4 border border-green-100 hover:border-green-200 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900">{booking.advisorName}</p>
                    {getStatusBadge(booking.status)}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    {booking.topic && <p className="font-medium">Topic: {booking.topic}</p>}
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {booking.preferredTime}
                      </span>
                      <span className="capitalize">{booking.sessionType}</span>
                    </div>
                  </div>
                  {booking.responseMessage && (
                    <div className="mt-2 text-sm bg-gray-50 rounded p-2">
                      <p className="font-medium text-gray-700">Response:</p>
                      <p className="text-gray-600">{booking.responseMessage}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Advisors */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Advisors</h3>
          {advisors.length === 0 ? (
            <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
              <Users size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600 font-medium">No advisors available at the moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {advisors.map((advisor) => (
                <div
                  key={advisor.id}
                  className="bg-white rounded-2xl border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all p-6"
                >
                  {/* Profile Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-2xl font-bold">
                      {advisor.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900">{advisor.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star size={16} className="text-amber-500 fill-current" />
                          <span className="font-semibold text-gray-900">{advisor.rating.toFixed(1)}</span>
                          <span className="text-sm text-gray-500">({advisor.totalReviews} reviews)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  {advisor.bio && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{advisor.bio}</p>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Briefcase size={14} />
                        <span className="text-xs font-medium">Experience</span>
                      </div>
                      <p className="font-semibold text-gray-900">{advisor.experience} years</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <Users size={14} />
                        <span className="text-xs font-medium">Clients</span>
                      </div>
                      <p className="font-semibold text-gray-900">{advisor.clientsCompleted} completed</p>
                    </div>
                  </div>

                  {/* Specializations */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <Award size={14} />
                      <span className="font-medium">Specializations</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {advisor.specialization.slice(0, 3).map((spec, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-medium px-3 py-1 bg-gray-100 text-gray-700 rounded-full"
                        >
                          {spec}
                        </span>
                      ))}
                      {advisor.specialization.length > 3 && (
                        <span className="text-xs font-medium px-3 py-1 bg-gray-100 text-gray-600 rounded-full">
                          +{advisor.specialization.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Social Links */}
                  {advisor.socialLinks && (
                    <div className="flex items-center gap-3 mb-4">
                      {advisor.socialLinks.linkedin && (
                        <a
                          href={advisor.socialLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-900 transition-colors"
                        >
                          <Linkedin size={18} />
                        </a>
                      )}
                      {advisor.socialLinks.twitter && (
                        <a
                          href={advisor.socialLinks.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-900 transition-colors"
                        >
                          <Twitter size={18} />
                        </a>
                      )}
                      {advisor.socialLinks.website && (
                        <a
                          href={advisor.socialLinks.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-900 transition-colors"
                        >
                          <Globe size={18} />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <p className="font-semibold text-gray-900">₹{advisor.hourlyRate}/hour</p>
                    <button
                      onClick={() => handleSelectAdvisor(advisor)}
                      className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors font-medium text-sm"
                    >
                      Book Session
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Booking Modal */}
        {showBookingModal && selectedAdvisor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Book Session with {selectedAdvisor.name}</h3>
                <p className="text-sm text-gray-600 mt-1">Fill in the details below to request a booking</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Session Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Session Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {['video', 'audio', 'chat'].map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setBookingForm((prev) => ({
                            ...prev,
                            sessionType: type as any,
                          }))
                        }
                        className={`p-3 rounded-lg border-2 capitalize font-medium transition-all ${
                          bookingForm.sessionType === type
                            ? 'border-black bg-gray-100 text-gray-900'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Topic (Optional)
                  </label>
                  <input
                    type="text"
                    value={bookingForm.topic}
                    onChange={(e) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        topic: e.target.value,
                      }))
                    }
                    placeholder="e.g., Tax planning for 2026"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white"
                  />
                </div>

                {/* Preferred Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      value={bookingForm.preferredDate}
                      onChange={(e) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          preferredDate: e.target.value,
                        }))
                      }
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Time
                    </label>
                    <input
                      type="time"
                      value={bookingForm.preferredTime}
                      onChange={(e) =>
                        setBookingForm((prev) => ({
                          ...prev,
                          preferredTime: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    value={bookingForm.message}
                    onChange={(e) =>
                      setBookingForm((prev) => ({
                        ...prev,
                        message: e.target.value,
                      }))
                    }
                    placeholder="Any additional information or questions for the advisor..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white"
                  />
                </div>

                {/* Pricing Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-900 font-medium">
                    <span className="font-semibold">Rate:</span> ₹{selectedAdvisor.hourlyRate}/hour
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Final pricing will be confirmed by the advisor based on session duration
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowBookingModal(false);
                    setSelectedAdvisor(null);
                  }}
                  className="px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitBooking}
                  disabled={isSubmitting}
                  className="px-4 py-3 bg-black text-white rounded-xl hover:bg-gray-900 disabled:bg-gray-300 font-medium"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CenteredLayout>
  );
};
