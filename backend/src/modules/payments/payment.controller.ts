import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';

// Get payments for user
export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { type } = req.query; // 'sent' for advisor, 'received' for client

    let query: any = {
      OR: [
        { clientId: userId },
        { advisorId: userId },
      ],
    };

    if (type === 'sent') {
      query = { clientId: userId };
    } else if (type === 'received') {
      query = { advisorId: userId };
    }

    const payments = await prisma.payment.findMany({
      where: query,
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        advisor: {
          select: { id: true, name: true, email: true },
        },
        session: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch payments' });
  }
};

// Get specific payment
export const getPayment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        advisor: {
          select: { id: true, name: true, email: true },
        },
        session: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify user is involved
    if (payment.clientId !== userId && payment.advisorId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch payment' });
  }
};

// Initiate payment
export const initiatePayment = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = getUserId(req);
    const { sessionId, paymentMethod, description } = req.body;

    if (!sessionId || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, paymentMethod' });
    }

    const session = await prisma.advisorSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if payment already exists
    const existingPayment = await prisma.payment.findUnique({
      where: { sessionId },
    });

    if (existingPayment) {
      return res.status(400).json({ error: 'Payment already initiated for this session' });
    }

    // Get booking for amount
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: session.bookingId },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        sessionId,
        clientId,
        advisorId: session.advisorId,
        amount: booking.amount,
        currency: 'USD',
        status: 'pending',
        paymentMethod,
        description: description || `Payment for ${session.sessionType} session`,
      },
    });

    // TODO: Integrate with Stripe/Razorpay
    // For now, return payment intent

    res.status(201).json({
      payment,
      // TODO: Add payment gateway integration response
      // stripe_client_secret: "...",
      // razorpay_order_id: "...",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to initiate payment' });
  }
};

// Confirm payment completion (called by webhook or frontend)
export const completePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId, transactionId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'Missing paymentId' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update payment to completed
    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'completed',
        transactionId: transactionId || payment.transactionId,
      },
    });

    // Notify advisor about payment completion
    await prisma.notification.create({
      data: {
        userId: payment.advisorId,
        title: 'Payment Received',
        message: `You received a payment of ${payment.amount} ${payment.currency}`,
        category: 'payment',
        deepLink: `/payments/${paymentId}`,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to complete payment' });
  }
};

// Handle payment failure
export const failPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId, reason } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'Missing paymentId' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update payment to failed
    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'failed' },
    });

    // Notify client
    await prisma.notification.create({
      data: {
        userId: payment.clientId,
        title: 'Payment Failed',
        message: `Your payment of ${payment.amount} ${payment.currency} failed${reason ? ': ' + reason : ''}. Please try again.`,
        category: 'payment',
        deepLink: `/sessions/${payment.sessionId}`,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to handle payment failure' });
  }
};

// Refund payment
export const refundPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId, reason } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'Missing paymentId' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({ error: 'Can only refund completed payments' });
    }

    // TODO: Integrate with payment gateway for actual refund processing
    // For now, just update the status

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'refunded' },
    });

    // Notify both parties
    await prisma.notification.create({
      data: {
        userId: payment.clientId,
        title: 'Payment Refunded',
        message: `Your payment of ${payment.amount} ${payment.currency} has been refunded${reason ? ': ' + reason : ''}`,
        category: 'payment',
      },
    });

    await prisma.notification.create({
      data: {
        userId: payment.advisorId,
        title: 'Payment Refunded',
        message: `A payment of ${payment.amount} ${payment.currency} was refunded${reason ? ': ' + reason : ''}`,
        category: 'payment',
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to refund payment' });
  }
};

// Webhook handler for payment gateway
export const handleWebhook = async (req: any, res: Response) => {
  try {
    const { type, paymentId, transactionId, status } = req.body;

    console.log(`Webhook received: ${type} for payment ${paymentId} - status: ${status}`);

    if (status === 'success') {
      await completePayment({ body: { paymentId, transactionId } } as any, res);
    } else if (status === 'failed') {
      await failPayment({ body: { paymentId, reason: 'Payment processing failed' } } as any, res);
    } else {
      res.status(400).json({ error: 'Unknown webhook status' });
    }
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message || 'Webhook processing failed' });
  }
};
