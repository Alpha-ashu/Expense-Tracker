import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { requireFeature, requireRole, requireApproved } from '../../middleware/rbac';
import { prisma } from '../../db/prisma';

// Create a new booking request
export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = getUserId(req);
    const { advisorId, sessionType, description, proposedDate, proposedTime, duration, amount } = req.body;

    // Validate required fields
    if (!advisorId || !sessionType || !proposedDate || !proposedTime || !duration || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify advisor exists and is approved
    const advisor = await prisma.user.findUnique({
      where: { id: advisorId },
    });

    if (!advisor || advisor.role !== 'advisor' || !advisor.isApproved) {
      return res.status(404).json({ error: 'Advisor not found or not approved' });
    }

    // Check advisor availability
    const proposedDateTime = new Date(`${proposedDate}T${proposedTime}`);
    const dayOfWeek = proposedDateTime.getDay();

    const availability = await prisma.advisorAvailability.findFirst({
      where: {
        advisorId,
        dayOfWeek,
        isActive: true,
      },
    });

    if (!availability) {
      return res.status(400).json({ error: 'Advisor not available at this time' });
    }

    // Create booking request
    const booking = await prisma.bookingRequest.create({
      data: {
        clientId,
        advisorId,
        sessionType,
        description: description || '',
        proposedDate: proposedDateTime,
        proposedTime,
        duration,
        amount,
        status: 'pending',
      },
    });

    // Create notification for advisor
    await prisma.notification.create({
      data: {
        userId: advisorId,
        title: 'New Booking Request',
        message: `${advisor.name} has requested a ${sessionType} session`,
        category: 'booking',
        deepLink: '/bookings',
      },
    });

    res.status(201).json(booking);
  } catch (error: any) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: error.message || 'Failed to create booking' });
  }
};

// Get user's bookings (as client or advisor)
export const getBookings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { role } = req.query;

    if (role === 'advisor') {
      // Get bookings where user is the advisor
      const bookings = await prisma.bookingRequest.findMany({
        where: { advisorId: userId },
        include: {
          client: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(bookings);
    } else {
      // Get bookings where user is the client
      const bookings = await prisma.bookingRequest.findMany({
        where: { clientId: userId },
        include: {
          advisor: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(bookings);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch bookings' });
  }
};

// Get specific booking
export const getBooking = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const booking = await prisma.bookingRequest.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        advisor: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify user is involved in this booking
    if (booking.clientId !== userId && booking.advisorId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(booking);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch booking' });
  }
};

// Accept booking (advisor only)
export const acceptBooking = async (req: AuthRequest, res: Response) => {
  try {
    const advisorId = getUserId(req);
    const { id } = req.params;

    const booking = await prisma.bookingRequest.findUnique({
      where: { id },
    });

    if (!booking || booking.advisorId !== advisorId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update booking status
    const updated = await prisma.bookingRequest.update({
      where: { id },
      data: { status: 'accepted' },
    });

    // Create advisor session
    const session = await prisma.advisorSession.create({
      data: {
        bookingId: id,
        advisorId,
        clientId: booking.clientId,
        startTime: booking.proposedDate,
        sessionType: booking.sessionType,
        status: 'scheduled',
      },
    });

    // Notify client
    await prisma.notification.create({
      data: {
        userId: booking.clientId,
        title: 'Booking Accepted',
        message: 'Your advisor has accepted your booking request',
        category: 'booking',
        deepLink: `/sessions/${session.id}`,
      },
    });

    res.json({ booking: updated, session });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to accept booking' });
  }
};

// Reject booking (advisor only)
export const rejectBooking = async (req: AuthRequest, res: Response) => {
  try {
    const advisorId = getUserId(req);
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await prisma.bookingRequest.findUnique({
      where: { id },
    });

    if (!booking || booking.advisorId !== advisorId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.bookingRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectionReason: reason || '',
      },
    });

    // Notify client
    await prisma.notification.create({
      data: {
        userId: booking.clientId,
        title: 'Booking Rejected',
        message: `Your advisor rejected your booking request${reason ? `: ${reason}` : ''}`,
        category: 'booking',
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reject booking' });
  }
};

// Cancel booking (client only)
export const cancelBooking = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = getUserId(req);
    const { id } = req.params;

    const booking = await prisma.bookingRequest.findUnique({
      where: { id },
    });

    if (!booking || booking.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot cancel this booking' });
    }

    const updated = await prisma.bookingRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    // Notify advisor
    await prisma.notification.create({
      data: {
        userId: booking.advisorId,
        title: 'Booking Cancelled',
        message: 'A client has cancelled their booking request',
        category: 'booking',
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cancel booking' });
  }
};
