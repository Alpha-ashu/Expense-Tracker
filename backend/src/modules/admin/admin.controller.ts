import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { prisma } from '../../db/prisma';

// Get all users (admin only)
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, approved } = req.query;

    let query: any = {};

    if (role) {
      query.role = role;
    }

    if (approved === 'true') {
      query.isApproved = true;
    } else if (approved === 'false') {
      query.isApproved = false;
    }

    const users = await prisma.user.findMany({
      where: query,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
};

// Get pending advisor requests (admin only)
export const getPendingAdvisors = async (req: AuthRequest, res: Response) => {
  try {
    const advisors = await prisma.user.findMany({
      where: {
        role: 'advisor',
        isApproved: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(advisors);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch pending advisors' });
  }
};

// Approve advisor (admin only)
export const approveAdvisor = async (req: AuthRequest, res: Response) => {
  try {
    const { advisorId } = req.params;

    const advisor = await prisma.user.findUnique({
      where: { id: advisorId },
    });

    if (!advisor || advisor.role !== 'advisor') {
      return res.status(404).json({ error: 'Advisor not found' });
    }

    const updated = await prisma.user.update({
      where: { id: advisorId },
      data: { isApproved: true },
    });

    // Notify advisor
    await prisma.notification.create({
      data: {
        userId: advisorId,
        title: 'Advisor Approved',
        message: 'Your advisor account has been approved. You can now accept bookings.',
        category: 'system',
        deepLink: '/advisor-panel',
      },
    });

    res.json({
      message: 'Advisor approved',
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isApproved: updated.isApproved,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to approve advisor' });
  }
};

// Reject advisor (admin only)
export const rejectAdvisor = async (req: AuthRequest, res: Response) => {
  try {
    const { advisorId } = req.params;
    const { reason } = req.body;

    const advisor = await prisma.user.findUnique({
      where: { id: advisorId },
    });

    if (!advisor || advisor.role !== 'advisor') {
      return res.status(404).json({ error: 'Advisor not found' });
    }

    // Update user back to regular user
    const updated = await prisma.user.update({
      where: { id: advisorId },
      data: {
        role: 'user',
        isApproved: false,
      },
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: advisorId,
        title: 'Advisor Request Rejected',
        message: `Your advisor request has been rejected${reason ? ': ' + reason : ''}`,
        category: 'system',
      },
    });

    res.json({
      message: 'Advisor rejected',
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reject advisor' });
  }
};

// Get platform statistics (admin only)
export const getPlatformStats = async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      advisorCount,
      approvedAdvisors,
      totalBookings,
      completedSessions,
      totalPayments,
      totalRevenue,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'advisor' } }),
      prisma.user.count({ where: { role: 'advisor', isApproved: true } }),
      prisma.bookingRequest.count(),
      prisma.advisorSession.count({ where: { status: 'completed' } }),
      prisma.payment.count({ where: { status: 'completed' } }),
      prisma.payment.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      users: {
        total: totalUsers,
        advisors: approvedAdvisors,
        advisorRequests: advisorCount - approvedAdvisors,
      },
      bookings: {
        total: totalBookings,
        completedSessions,
        pendingBookings: await prisma.bookingRequest.count({ where: { status: 'pending' } }),
      },
      payments: {
        total: totalPayments,
        totalRevenue: totalRevenue._sum.amount || 0,
        currency: 'USD',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch statistics' });
  }
};

// Feature flags management
export const getFeatureFlags = async (req: AuthRequest, res: Response) => {
  try {
    // For now, return hardcoded flags
    // TODO: Implement persistent feature flags in database
    const flags = {
      advisorBooking: true,
      payments: true,
      groups: false,
      investments: true,
      loanTracking: true,
      taxCalculator: true,
      calendar: true,
      reports: true,
      realtime: false,
    };

    res.json(flags);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch feature flags' });
  }
};

// Toggle feature flag (admin only)
export const toggleFeatureFlag = async (req: AuthRequest, res: Response) => {
  try {
    const { flag, enabled } = req.body;

    if (!flag || enabled === undefined) {
      return res.status(400).json({ error: 'Missing required fields: flag, enabled' });
    }

    // TODO: Implement persistent storage for feature flags
    // For now, just acknowledge the request
    console.log(`Admin toggled feature flag: ${flag} = ${enabled}`);

    res.json({
      message: `Feature flag '${flag}' toggled to ${enabled}`,
      flag,
      enabled,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to toggle feature flag' });
  }
};

// Get users report (admin only)
export const getUsersReport = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    let where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      total: users.length,
      users,
      generatedAt: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate users report' });
  }
};

// Get revenue report (admin only)
export const getRevenueReport = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    let where: any = { status: 'completed' };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        advisor: {
          select: { name: true },
        },
      },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const byAdvisor = payments.reduce(
      (acc, p) => {
        const advisorName = p.advisor.name;
        if (!acc[advisorName]) {
          acc[advisorName] = { count: 0, total: 0 };
        }
        acc[advisorName].count += 1;
        acc[advisorName].total += p.amount;
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    res.json({
      totalRevenue,
      paymentCount: payments.length,
      currency: 'USD',
      byAdvisor,
      generatedAt: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate revenue report' });
  }
};
