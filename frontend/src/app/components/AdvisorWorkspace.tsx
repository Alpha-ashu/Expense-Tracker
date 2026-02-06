import React, { useState } from 'react';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { ChevronLeft, MessageCircle, Clock, CheckCircle, AlertCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

export const AdvisorWorkspace: React.FC = () => {
  const { setCurrentPage } = useApp();
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'bookings' | 'chat'>('users');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');

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

  const handleAcceptBooking = async (bookingId: number) => {
    try {
      await db.bookingRequests.update(bookingId, {
        status: 'accepted',
        respondedAt: new Date(),
      });
      toast.success('Booking accepted');
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
            <h2 className="text-2xl font-bold text-gray-900">Advisor Workspace</h2>
            <p className="text-gray-500 mt-1">Manage your clients and consultations</p>
          </div>
        </div>

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

                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleAcceptBooking(booking.id!)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={16} />
                      Accept
                    </button>
                    <button
                      onClick={() => handleRejectBooking(booking.id!)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <AlertCircle size={16} />
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
      </div>
    </CenteredLayout>
  );
};
