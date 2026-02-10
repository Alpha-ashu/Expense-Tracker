/**
 * Payment Settlement System
 * Handles payment processing for advisor sessions
 */

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'credit_card' | 'debit_card' | 'upi' | 'bank_transfer';

export interface Payment {
  id?: number;
  bookingId: number;
  sessionId: number;
  userId: string;
  advisorId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  processedAt?: Date;
  completedAt?: Date;
  refundReason?: string;
  refundedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface TransactionRecord {
  id?: number;
  paymentId: number;
  type: 'debit' | 'credit'; // debit for user, credit for advisor
  amount: number;
  currency: string;
  description: string;
  status: PaymentStatus;
  createdAt: Date;
}

/**
 * Calculate platform fee (e.g., 10% to platform, 90% to advisor)
 */
export const PLATFORM_FEE_PERCENTAGE = 10;

export const calculatePlatformSplit = (
  totalAmount: number
): { advisorAmount: number; platformAmount: number } => {
  const platformAmount = (totalAmount * PLATFORM_FEE_PERCENTAGE) / 100;
  const advisorAmount = totalAmount - platformAmount;

  return {
    advisorAmount: Math.round(advisorAmount * 100) / 100,
    platformAmount: Math.round(platformAmount * 100) / 100,
  };
};

/**
 * Payment status flow
 */
export const PAYMENT_STATE_FLOW = {
  pending: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: ['refunded'],
  failed: ['processing'],
  refunded: [],
} as Record<PaymentStatus, PaymentStatus[]>;

/**
 * Check if payment state transition is valid
 */
export const isValidPaymentTransition = (
  currentState: PaymentStatus,
  newState: PaymentStatus
): boolean => {
  const allowedStates = PAYMENT_STATE_FLOW[currentState];
  return allowedStates.includes(newState);
};

/**
 * Process payment
 * In production, this would integrate with payment gateway (Stripe, Razorpay, etc.)
 */
export const processPayment = async (
  payment: Omit<Payment, 'id' | 'processedAt'>
): Promise<{ success: boolean; transactionId: string; error?: string }> => {
  try {
    // Simulate payment processing
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // In production: Call payment gateway API
    // const result = await paymentGateway.charge({
    //   amount: payment.amount,
    //   currency: payment.currency,
    //   paymentMethod: payment.paymentMethod,
    //   customerId: payment.userId,
    // });

    return {
      success: true,
      transactionId,
    };
  } catch (error) {
    return {
      success: false,
      transactionId: '',
      error: error instanceof Error ? error.message : 'Payment processing failed',
    };
  }
};

/**
 * Create settlement record for advisor
 * Transfers funds to advisor account
 */
export const settlePaymentToAdvisor = async (
  advisorId: string,
  amount: number,
  currency: string
): Promise<{ success: boolean; settlementId: string; error?: string }> => {
  try {
    // Simulate settlement
    const settlementId = `SETTLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // In production: Call payment gateway to transfer to advisor account
    // const result = await paymentGateway.transfer({
    //   amount,
    //   currency,
    //   recipientId: advisorId,
    // });

    return {
      success: true,
      settlementId,
    };
  } catch (error) {
    return {
      success: false,
      settlementId: '',
      error: error instanceof Error ? error.message : 'Settlement failed',
    };
  }
};

/**
 * Refund payment
 */
export const refundPayment = async (
  payment: Payment,
  reason: string
): Promise<{ success: boolean; refundId: string; error?: string }> => {
  try {
    if (!payment.transactionId) {
      throw new Error('Cannot refund payment without transaction ID');
    }

    const refundId = `REFUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // In production: Call payment gateway to issue refund
    // const result = await paymentGateway.refund({
    //   transactionId: payment.transactionId,
    //   amount: payment.amount,
    //   reason,
    // });

    return {
      success: true,
      refundId,
    };
  } catch (error) {
    return {
      success: false,
      refundId: '',
      error: error instanceof Error ? error.message : 'Refund failed',
    };
  }
};

/**
 * Get payment status color
 */
export const getPaymentStatusColor = (status: PaymentStatus): string => {
  const colors: Record<PaymentStatus, string> = {
    pending: 'yellow',
    processing: 'blue',
    completed: 'green',
    failed: 'red',
    refunded: 'gray',
  };
  return colors[status];
};

/**
 * Get payment status label
 */
export const getPaymentStatusLabel = (status: PaymentStatus): string => {
  const labels: Record<PaymentStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    refunded: 'Refunded',
  };
  return labels[status];
};
