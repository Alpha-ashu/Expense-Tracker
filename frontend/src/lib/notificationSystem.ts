/**
 * Notification System
 * Triggers notifications for critical user actions
 */

export type NotificationType =
  | 'booking_request' // User booked, advisor notified
  | 'booking_accepted' // Advisor accepted, user notified
  | 'session_ready' // Both parties ready confirmation
  | 'session_started' // Session began
  | 'session_completed' // Session ended
  | 'payment_settled' // Payment processed
  | 'payment_received' // Advisor received payment
  | 'booking_rejected' // Advisor declined
  | 'role_changed' // User role changed
  | 'feature_released'; // New feature available

export interface Notification {
  id?: number;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedBookingId?: number;
  relatedSessionId?: number;
  isRead: boolean;
  createdAt: Date;
  actionUrl?: string;
}

/**
 * Notification Templates
 */
export const NOTIFICATION_TEMPLATES: Record<NotificationType, {
  title: string;
  message: (data: Record<string, any>) => string;
  icon: string;
}> = {
  booking_request: {
    title: 'New Booking Request',
    message: (data) => `${data.userName} has booked a session for ${data.date} at ${data.time}`,
    icon: '📅',
  },
  booking_accepted: {
    title: 'Booking Confirmed',
    message: (data) => `${data.advisorName} has accepted your booking for ${data.date}`,
    icon: '✅',
  },
  session_ready: {
    title: 'Session Ready',
    message: (data) => `Both parties are ready. Click to start the ${data.sessionType} session`,
    icon: '🚀',
  },
  session_started: {
    title: 'Session Started',
    message: (data) => `Your ${data.sessionType} session with ${data.otherPartyName} has started`,
    icon: '▶️',
  },
  session_completed: {
    title: 'Session Completed',
    message: (data) => `Session with ${data.otherPartyName} completed. Payment processing...`,
    icon: '🏁',
  },
  payment_settled: {
    title: 'Payment Processed',
    message: (data) => `Payment of ${data.amount} for ${data.advisorName} session processed`,
    icon: '💳',
  },
  payment_received: {
    title: 'Payment Received',
    message: (data) => `You received ${data.amount} from ${data.userName} for session on ${data.date}`,
    icon: '💰',
  },
  booking_rejected: {
    title: 'Booking Declined',
    message: (data) => `${data.advisorName} has declined your booking request`,
    icon: '❌',
  },
  role_changed: {
    title: 'Role Updated',
    message: (data) => `Your role has been changed to ${data.newRole}`,
    icon: '👤',
  },
  feature_released: {
    title: 'New Feature Available',
    message: (data) => `${data.featureName} is now available for you to use`,
    icon: '✨',
  },
};

/**
 * Create notification for user
 */
export const createNotification = (
  userId: string,
  type: NotificationType,
  data: Record<string, any>,
  relatedIds?: { bookingId?: number; sessionId?: number }
): Notification => {
  const template = NOTIFICATION_TEMPLATES[type];
  
  return {
    userId,
    type,
    title: template.title,
    message: template.message(data),
    relatedBookingId: relatedIds?.bookingId,
    relatedSessionId: relatedIds?.sessionId,
    isRead: false,
    createdAt: new Date(),
  };
};

/**
 * Determine who should be notified
 */
export const getNotificationRecipients = (
  type: NotificationType,
  data: Record<string, any>
): string[] => {
  switch (type) {
    case 'booking_request':
      return [data.advisorId]; // Only advisor
    case 'booking_accepted':
      return [data.userId]; // Only user
    case 'session_ready':
    case 'session_started':
    case 'session_completed':
      return [data.userId, data.advisorId]; // Both parties
    case 'payment_settled':
      return [data.userId]; // User
    case 'payment_received':
      return [data.advisorId]; // Advisor
    case 'booking_rejected':
      return [data.userId]; // User
    case 'role_changed':
      return [data.userId]; // User whose role changed
    case 'feature_released':
      return ['all_users']; // Broadcast to all
    default:
      return [];
  }
};

/**
 * Critical notifications that should trigger alerts
 */
export const CRITICAL_NOTIFICATIONS: NotificationType[] = [
  'booking_request',
  'session_ready',
  'session_completed',
  'payment_received',
];

/**
 * Check if notification should trigger alert/sound
 */
export const shouldPlayAlert = (type: NotificationType): boolean => {
  return CRITICAL_NOTIFICATIONS.includes(type);
};
