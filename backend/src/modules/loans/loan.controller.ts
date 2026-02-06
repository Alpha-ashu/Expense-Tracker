import { Response } from 'express';
import { AuthRequest, getUserId } from '../../middleware/auth';
import { prisma } from '../../db/prisma';

export const getLoans = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);

    const loans = await prisma.loan.findMany({
      where: { userId, deletedAt: null },
      include: { payments: { orderBy: { date: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loans' });
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
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const loan = await prisma.loan.create({
      data: {
        userId,
        type,
        name,
        principalAmount,
        outstandingBalance: principalAmount,
        interestRate,
        emiAmount,
        dueDate: dueDate ? new Date(dueDate) : null,
        frequency,
        contactPerson,
        status: 'active',
      },
      include: { payments: true },
    });

    res.status(201).json(loan);
  } catch (error) {
    console.error('Failed to create loan:', error);
    res.status(500).json({ error: 'Failed to create loan' });
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

    res.json(loan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loan' });
  }
};

export const updateLoan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const loan = await prisma.loan.findUnique({
      where: { id },
    });

    if (!loan || loan.userId !== userId) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const updated = await prisma.loan.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() },
      include: { payments: true },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update loan' });
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

    res.json({ message: 'Loan deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete loan' });
  }
};

export const addLoanPayment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { amount, accountId, notes } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
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
        amount,
        accountId,
        date: new Date(),
        notes,
      },
    });

    // Update outstanding balance
    const newBalance = Math.max(0, loan.outstandingBalance - amount);
    await prisma.loan.update({
      where: { id },
      data: {
        outstandingBalance: newBalance,
        status: newBalance === 0 ? 'completed' : 'active',
      },
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error('Failed to add loan payment:', error);
    res.status(500).json({ error: 'Failed to add loan payment' });
  }
};
