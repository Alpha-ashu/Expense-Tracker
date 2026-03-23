import { describe, expect, it } from 'vitest';
import { parseMultipleTransactions, parseVoiceExpense } from './voiceExpenseParser';

describe('voiceExpenseParser', () => {
  it('keeps a shared phrase with the amount instead of splitting too early', () => {
    const result = parseMultipleTransactions('food and drinks 500 and taxi 200');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      intent: 'expense',
      amount: 500,
      category: 'Food & Dining',
    });
    expect(result[1]).toMatchObject({
      intent: 'expense',
      amount: 200,
      category: 'Transportation',
    });
  });

  it('classifies salary credits, bill payments, and transfers correctly', () => {
    expect(parseVoiceExpense('salary credited 50000')).toMatchObject({
      intent: 'income',
      amount: 50000,
      category: 'Salary',
    });

    expect(parseVoiceExpense('paid electricity bill 1200')).toMatchObject({
      intent: 'expense',
      amount: 1200,
      category: 'Utilities',
    });

    expect(parseVoiceExpense('transferred 5000 to savings account')).toMatchObject({
      intent: 'transfer',
      amount: 5000,
      category: 'Transfer',
    });
  });

  it('prefers the real money amount over day-like numbers', () => {
    const result = parseVoiceExpense('paid 500 on 12 for lunch');

    expect(result.amount).toBe(500);
    expect(result.intent).toBe('expense');
    expect(result.category).toBe('Food & Dining');
  });
});
