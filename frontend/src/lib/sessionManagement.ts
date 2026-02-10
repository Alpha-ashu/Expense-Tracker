/**
 * Advisor Session Management
 * Handles booking, session states, and completion
 */

export type SessionStatus = 'pending' | 'accepted' | 'ready' | 'active' | 'completed' | 'cancelled';
export type SessionType = 'chat' | 'audio' | 'video';

export interface AdvisorBooking {
  id?: number;
  advisorId: string;
  userId: string;
  sessionType: SessionType;
  topic?: string;
  preferredDate: string;
  preferredTime: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  hourlyRate: number;
  estimatedDuration: number; // in minutes
  totalAmount: number;
  createdAt: Date;
  respondedAt?: Date;
  responseMessage?: string;
}

export interface AdvisorSession {
  id?: number;
  bookingId: number;
  advisorId: string;
  userId: string;
  sessionType: SessionType;
  status: SessionStatus;
  startedAt?: Date;
  completedAt?: Date;
  actualDuration?: number; // in minutes
  amountPaid: number;
  notes?: string;
  rating?: number;
  feedback?: string;
}

/**
 * Session State Transitions
 * pending -> accepted -> ready -> active -> completed
 */
export const SESSION_STATE_FLOW = {
  pending: ['accepted', 'cancelled'],
  accepted: ['ready', 'cancelled'],
  ready: ['active', 'cancelled'],
  active: ['completed'],
  completed: [],
  cancelled: [],
} as Record<SessionStatus, SessionStatus[]>;

/**
 * Check if transition is valid
 */
export const isValidStateTransition = (
  currentState: SessionStatus,
  newState: SessionStatus
): boolean => {
  const allowedStates = SESSION_STATE_FLOW[currentState];
  return allowedStates.includes(newState);
};

/**
 * Get human-readable status
 */
export const getStatusLabel = (status: SessionStatus): string => {
  const labels: Record<SessionStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    ready: 'Ready to Start',
    active: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status];
};

/**
 * Calculate session amount
 */
export const calculateSessionAmount = (
  hourlyRate: number,
  durationMinutes: number
): number => {
  const hours = durationMinutes / 60;
  return Math.ceil(hours * hourlyRate * 100) / 100; // Round up to nearest 0.01
};

/**
 * Get session color for UI
 */
export const getStatusColor = (status: SessionStatus): string => {
  const colors: Record<SessionStatus, string> = {
    pending: 'yellow',
    accepted: 'blue',
    ready: 'green',
    active: 'purple',
    completed: 'gray',
    cancelled: 'red',
  };
  return colors[status];
};
