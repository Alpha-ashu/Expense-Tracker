import React, { useState } from 'react';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { ChevronLeft, MessageCircle, Clock, CheckCircle, AlertCircle, Send, XCircle, RotateCw, Power } from 'lucide-react';
import { toast } from 'sonner';

export const AdvisorWorkspace: React.FC = () => {
  const { setCurrentPage } = useApp();
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'bookings' | 'chat'>('bookings');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [rescheduleModal, setRescheduleModal] = useState<{ id: number; date: string; time: string } | null>(null);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);

  // Only advisors can access this
  if (role !== 'advisor') {
    return (
      <CenteredLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">Only advisors can access the workspace.</p>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </CenteredLayout>
    );
  }

  // Query advisor's own profile for availability status
  const advisorProfile = useLiveQuery(
    () => db.financeAdvisors.where('userId').equals(user?.id || '').first(),
    [user?.id]
  );

  // Query assigned users
  const assignments = useLiveQuery(
    () => db.advisorAssignments.where('advisorId').equals(user?.id || '').toArray(),
    [user?.id]
  ) || [];

  // Query pending booking requests
  const bookingRequests = useLiveQuery(
    () => db.bookingRequests.where('advisorId').equals(user?.id || '').and((req) => req.status === 'pending').toArray(),
    [user?.id]
  ) || [];

  // Query chat messages for selected conversation
  const chatMessages = useLiveQuery(
    () => selectedChat ? db.chatMessages.where('conversationId').equals(selectedChat).toArray() : Promise.resolve([]),
    [selectedChat]
  ) || [];

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat || !user) return;

    try {
      await db.chatMessages.add({
        conversationId: selectedChat,
        senderId: user.id,
        senderRole: 'advisor',
        message: messageInput.trim(),
        timestamp: new Date(),
        isRead: false,
      });

      setMessageInput('');
      toast.success('Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleToggleAvailability = async () => {
    if (!advisorProfile?.id || !user) return;

    setIsTogglingAvailability(true);
    try {
      const newStatus = !advisorProfile.availability;
      await db.financeAdvisors.update(advisorProfile.id, {
        availability: newStatus,
      });
      toast.success(`You are now ${newStatus ? 'available' : 'unavailable'} for bookings`);
    } catch (error) {
      console.error('Error toggling availability:', error);
      toast.error('Failed to update availability');
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const handleAcceptBooking = async (bookingId: number, booking: any) => {
    try {
      const conversationId = `${user?.id}_${booking.userId}`;\n
      // Create or update chat conversation
      const existing = await db.chatConversations.where('conversationId').equals(conversationId).first();
      if (!existing) {
        await db.chatConversations.add({
          conversationId,
          advisorId: user!.id,
          userId: booking.userId,
          advisorInitiated: true,
          createdAt: new Date(),
        });
      }

      // Update booking status
      await db.bookingRequests.update(bookingId, {
        status: 'accepted',
        respondedAt: new Date(),
      });
      
      // Create notification for user with deepLink to calendar
      await db.notifications.add({
        type: 'booking',
        title: 'Booking Accepted',
        message: `Your session with ${user!.email} has been accepted! Check your calendar for details.`,
        isRead: false,
        userId: booking.userId,
        deepLink: '/calendar?session=' + bookingId,
        createdAt: new Date(),
      });
      
      toast.success('Booking accepted! Chat has been unlocked.');
    } catch (error) {
      console.error('Error accepting booking:', error);
      toast.error('Failed to accept booking');
    }
  };

  const handleRejectBooking = async (bookingId: number) => {
    try {
      await db.bookingRequests.update(bookingId, {
        status: 'rejected',
        respondedAt: new Date(),
      });
      toast.success('Booking rejected');
    } catch (error) {
      console.error('Error rejecting booking:', error);
      toast.error('Failed to reject booking');
    }
  };

  const handleRescheduleBooking = async (bookingId: number, newDate: string, newTime: string) => {
    try {
      const booking = await db.bookingRequests.get(bookingId);
      if (!booking) return;
      
      await db.bookingRequests.update(bookingId, {
        status: 'reschedule',
        respondedAt: new Date(),
        responseMessage: `Advisor proposed new time: ${newDate} at ${newTime}`,
        preferredTime: `${newDate} ${newTime}`,
      });
      
      // Create notification for user with deepLink to calendar
      await db.notifications.add({
        type: 'booking',
        title: 'Session Rescheduled',
        message: `Your advisor has proposed a new time: ${newDate} at ${newTime}. Check your calendar to confirm.`,
        isRead: false,
        userId: booking.userId,
        deepLink: '/calendar?session=' + bookingId,
        createdAt: new Date(),
      });
      
      toast.success('Reschedule request sent to user');
      setRescheduleModal(null);
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      toast.error('Failed to reschedule booking');
    }
  };

  return (
    <CenteredLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={24} className="text-gray-600" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Advisor Workspace</h2>
              <p className="text-gray-500 mt-1">Manage your clients and consultations</p>
            </div>
          </div>

          {/* Availability Toggle */}
          {advisorProfile && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Availability Status:</span>
              <button
                onClick={handleToggleAvailability}
                disabled={isTogglingAvailability}
                className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
                  advisorProfile.availability
                    ? 'bg-green-50 text-green-700 border-2 border-green-500 hover:bg-green-100'
                    : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200'
                }`}
              >
                <Power size={18} className={advisorProfile.availability ? 'text-green-600' : 'text-gray-600'} />
                <span>{advisorProfile.availability ? 'AVAILABLE' : 'UNAVAILABLE'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Availability Status Card */}
        {advisorProfile && (
          <div className={`rounded-lg p-4 border-2 ${
            advisorProfile.availability
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <p className={`text-sm font-medium ${
              advisorProfile.availability ? 'text-green-900' : 'text-yellow-900'
            }`}>
              {advisorProfile.availability
                ? '✓ You are currently visible to users and can receive booking requests'
                : '⚠ You are hidden from users. Toggle availability to start receiving bookings'}
            </p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'users'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Assigned Users ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'bookings'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Booking Requests ({bookingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'chat'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Messages
          </button>
        </div>

        {/* Assigned Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            {assignments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-gray-600">No assigned users yet</p>
              </div>
            ) : (
              assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{assignment.userId}</h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {assignment.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{assignment.notes || 'No notes'}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedChat(`${user?.id}_${assignment.userId}`);
                        setActiveTab('chat');
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <MessageCircle size={16} />
                      Message
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Booking Requests Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-3">
            {bookingRequests.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-gray-600">No pending booking requests</p>
              </div>
            ) : (
              bookingRequests.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{booking.userEmail}</h3>
                      <p className="text-sm text-gray-600 mt-1">{booking.topic || 'General consultation'}</p>
                      <p className="text-xs text-gray-500 mt-1">Session type: {booking.sessionType}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                      <Clock size={12} />
                      Pending
                    </span>
                  </div>

                  {booking.message && (
                    <div className="bg-gray-50 rounded p-3 text-sm text-gray-700">
                      <p className="font-medium mb-1">Message:</p>
                      <p>{booking.message}</p>
                    </div>
                  )}

                  <div className="text-sm text-gray-600 bg-blue-50 rounded p-3">
                    <p className="font-medium text-blue-900">Preferred Time:</p>
                    <p className="mt-1">{booking.preferredTime || 'Not specified'}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleAcceptBooking(booking.id!, booking)}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={16} />
                      Accept
                    </button>
                    <button
                      onClick={() => setRescheduleModal({ id: booking.id!, date: '', time: '' })}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <RotateCw size={16} />
                      Reschedule
                    </button>
                    <button
                      onClick={() => handleRejectBooking(booking.id!)}
                      className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {!selectedChat ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <MessageCircle size={48} className="text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Select a user to start chatting</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 h-96 flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{selectedChat}</h3>
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.senderRole === 'advisor' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.senderRole === 'advisor'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className={`text-xs mt-1 ${msg.senderRole === 'advisor' ? 'text-blue-100' : 'text-gray-500'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors flex items-center gap-2"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reschedule Modal */}
        {rescheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Propose New Time</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Date
                  </label>
                  <input
                    type="date"
                    value={rescheduleModal.date}
                    onChange={(e) => setRescheduleModal({ ...rescheduleModal, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Time
                  </label>
                  <input
                    type="time"
                    value={rescheduleModal.time}
                    onChange={(e) => setRescheduleModal({ ...rescheduleModal, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                  <p>The user will receive a notification with your proposed time</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setRescheduleModal(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRescheduleBooking(rescheduleModal.id, rescheduleModal.date, rescheduleModal.time)}
                  disabled={!rescheduleModal.date || !rescheduleModal.time}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
                >
                  Propose Time
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CenteredLayout>
  );
};
