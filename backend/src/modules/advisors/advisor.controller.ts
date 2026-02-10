import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { requireRole, requireApproved } from '../../middleware/rbac';
import { prisma } from '../../db/prisma';

// List all approved advisors
export const listAdvisors = async (req: AuthRequest, res: Response) => {
  try {
    const advisors = await prisma.user.findMany({
      where: {
        role: 'advisor',
        isApproved: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        advisorAvailability: true,
      },
    });

    res.json(advisors);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch advisors' });
  }
};

// Get advisor profile
export const getAdvisor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const advisor = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isApproved: true,
        advisorAvailability: true,
        sessionsAsAdvisor: {
          where: { status: 'completed' },
          select: { rating: true },
        },
      },
    });

    if (!advisor || advisor.role !== 'advisor') {
      return res.status(404).json({ error: 'Advisor not found' });
    }

    // Calculate average rating
    const ratings = advisor.sessionsAsAdvisor.map((s: any) => s.rating).filter(Boolean);
    const averageRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b) / ratings.length : 0;

    res.json({
      ...advisor,
      averageRating,
      reviewCount: ratings.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch advisor' });
  }
};

// Update advisor availability
export const setAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const advisorId = getUserId(req);
    const { dayOfWeek, startTime, endTime, isActive } = req.body;

    // Validate
    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields: dayOfWeek, startTime, endTime' });
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ error: 'Invalid dayOfWeek (0-6)' });
    }

    // Check if availability exists for this day
    const existing = await prisma.advisorAvailability.findFirst({
      where: { advisorId, dayOfWeek },
    });

    let availability;
    if (existing) {
      availability = await prisma.advisorAvailability.update({
        where: { id: existing.id },
        data: { startTime, endTime, isActive: isActive !== false },
      });
    } else {
      availability = await prisma.advisorAvailability.create({
        data: {
          advisorId,
          dayOfWeek,
          startTime,
          endTime,
          isActive: true,
        },
      });
    }

    res.json(availability);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to set availability' });
  }
};

// Get advisor's availability
export const getAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const availability = await prisma.advisorAvailability.findMany({
      where: { advisorId: id },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json(availability);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch availability' });
  }
};

// Delete availability slot
export const deleteAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const advisorId = getUserId(req);
    const { id } = req.params;

    const availability = await prisma.advisorAvailability.findUnique({
      where: { id },
    });

    if (!availability || availability.advisorId !== advisorId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.advisorAvailability.delete({
      where: { id },
    });

    res.json({ message: 'Availability deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete availability' });
  }
};

// Get advisor's sessions
export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    const advisorId = getUserId(req);

    const sessions = await prisma.advisorSession.findMany({
      where: { advisorId },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        chatMessages: true,
        payment: true,
      },
      orderBy: { startTime: 'desc' },
    });

    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch sessions' });
  }
};

// Rate a session (client only)
export const rateSession = async (req: AuthRequest, res: Response) => {
  try {
    const clientId = getUserId(req);
    const { id } = req.params;
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const session = await prisma.advisorSession.findUnique({
      where: { id },
    });

    if (!session || session.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({ error: 'Can only rate completed sessions' });
    }

    const updated = await prisma.advisorSession.update({
      where: { id },
      data: { rating, feedback: feedback || '' },
    });

    // Notify advisor about the rating
    await prisma.notification.create({
      data: {
        userId: session.advisorId,
        title: 'New Session Rating',
        message: `You received a ${rating} star rating`,
        category: 'session',
        deepLink: `/sessions/${id}`,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to rate session' });
  }
};
