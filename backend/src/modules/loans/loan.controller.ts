import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';
import { sanitize } from '../../utils/sanitize';
import { logger } from '../../config/logger';
import { cacheDeleteByPrefix } from '../../cache/redis';
import { isDatabaseUnavailableError } from '../../utils/databaseAvailability';

export const getLoans = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);

    const loans = await prisma.loan.findMany({
      where: { userId, deletedAt: null },
      include: { payments: { orderBy: { date: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: loans });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      logger.warn('Loans fallback: database unavailable, returning empty dataset.');
      return res.json({ success: true, data: [] });
    }

    res.status(500).json({ success: false, error: 'Failed to fetch loans' });
  }
};

export const createLoan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const {
      type,
      name,
      principalAmount,
      interestRate,
      emiAmount,
      dueDate,
      frequency,
      contactPerson,
    } = req.body;

    if (!type || !name || !principalAmount) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const numericPrincipal = Number(principalAmount);
    if (!isFinite(numericPrincipal) || numericPrincipal <= 0) {
      return res.status(400).json({ success: false, error: 'Principal amount must be a positive number' });
    }

    const loan = await prisma.loan.create({
      data: {
        userId,
        type,
        name: sanitize(name),
        principalAmount: numericPrincipal,
        outstandingBalance: numericPrincipal,
        interestRate,
        emiAmount,
        dueDate: dueDate ? new Date(dueDate) : null,
        frequency,
        contactPerson: contactPerson ? sanitize(contactPerson) : undefined,
        status: 'active',
      },
      include: { payments: true },
    });

    await cacheDeleteByPrefix('loans:');

    res.status(201).json({ success: true, data: loan });
  } catch (error) {
    logger.error('Failed to create loan', { error });
    res.status(500).json({ success: false, error: 'Failed to create loan' });
  }
};

export const getLoan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { payments: { orderBy: { date: 'desc' } } },
    });

    if (!loan || loan.userId !== userId) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch loan' });
  }
};

export const updateLoan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const body = req.body;

    // Verify ownership
    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.userId !== userId) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Validate numeric fields if provided
    if (body.principalAmount !== undefined) {
      const numAmount = Number(body.principalAmount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Principal amount must be a positive number' });
      }
    }

    if (body.outstandingBalance !== undefined) {
      const numBalance = Number(body.outstandingBalance);
      if (!Number.isFinite(numBalance) || numBalance < 0) {
        return res.status(400).json({ success: false, error: 'Outstanding balance must be a non-negative number' });
      }
    }

    if (body.interestRate !== undefined) {
      const numRate = Number(body.interestRate);
      if (!Number.isFinite(numRate) || numRate < 0) {
        return res.status(400).json({ success: false, error: 'Interest rate must be a non-negative number' });
      }
    }

    if (body.emiAmount !== undefined) {
      const numEmi = Number(body.emiAmount);
      if (!Number.isFinite(numEmi) || numEmi < 0) {
        return res.status(400).json({ success: false, error: 'EMI amount must be a non-negative number' });
      }
    }

    // Whitelist only permitted fields to prevent mass assignment
    const allowedFields = ['name', 'type', 'principalAmount', 'outstandingBalance', 'interestRate', 'emiAmount', 'dueDate', 'frequency', 'contactPerson', 'status', 'syncStatus'] as const;
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Sanitize text fields
        if ((field === 'name' || field === 'contactPerson') && typeof body[field] === 'string') {
          updates[field] = sanitize(body[field]);
        } else {
          updates[field] = body[field];
        }
      }
    }
    if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);

    const updated = await prisma.loan.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() },
      include: { payments: true },
    });

    await cacheDeleteByPrefix('loans:');

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update loan' });
  }
};

export const deleteLoan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify ownership
    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.userId !== userId) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Soft delete
    await prisma.loan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await cacheDeleteByPrefix('loans:');

    res.json({ success: true, message: 'Loan deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete loan' });
  }
};

export const addLoanPayment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { amount, accountId, notes } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, error: 'Amount is required' });
    }

    // Validate amount is a positive finite number
    const numericAmount = Number(amount);
    if (!isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be a positive number' });
    }

    // Verify ownership
    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.userId !== userId) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Create payment record
    const payment = await prisma.loanPayment.create({
      data: {
        loanId: id,
        amount: numericAmount,
        accountId,
        date: new Date(),
        notes,
      },
    });

    // Update outstanding balance
    const newBalance = Math.max(0, loan.outstandingBalance - numericAmount);
    await prisma.loan.update({
      where: { id },
      data: {
        outstandingBalance: newBalance,
        status: newBalance === 0 ? 'completed' : 'active',
      },
    });

    await cacheDeleteByPrefix('loans:');

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    logger.error('Failed to add loan payment', { error });
    res.status(500).json({ success: false, error: 'Failed to add loan payment' });
  }
};
