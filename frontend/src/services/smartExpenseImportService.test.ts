import { describe, expect, it, vi } from 'vitest';
import { smartExpenseImportService } from './smartExpenseImportService';
import fs from 'fs';
import path from 'path';

// Mock the database
vi.mock('@/lib/database', () => ({
    db: {
        accounts: {
            toArray: vi.fn(async () => [
                { id: 1, name: 'ICICI Savings', type: 'bank', balance: 5000, currency: 'INR', isActive: true },
                { id: 2, name: 'Cash Wallet', type: 'cash', balance: 1000, currency: 'INR', isActive: true },
                { id: 3, name: 'HDFC Salary Account', type: 'bank', balance: 10000, currency: 'INR', isActive: true },
                { id: 4, name: 'SBI Account', type: 'bank', balance: 2000, currency: 'INR', isActive: true },
                { id: 5, name: 'Axis Bank', type: 'bank', balance: 3000, currency: 'INR', isActive: true },
            ]),
        },
        categories: {
            toArray: vi.fn(async () => []),
        },
        transactions: {
            toArray: vi.fn(async () => []),
        },
        settings: {
            get: vi.fn(async () => null),
        }
    },
}));

vi.mock('@/services/syncService', () => ({
    initializeBackendSync: vi.fn(),
}));

describe('SmartExpenseImportService Integration Test', () => {
    it('correctly parses the 250+ records third-party JSON', async () => {
        const rootDir = path.resolve(process.cwd(), '..');
        const filePath = path.join(rootDir, 'tests', 'expense_test_250_records.json');
        const jsonContent = fs.readFileSync(filePath, 'utf-8');

        const file = new File([jsonContent], 'expense_test_250_records.json', { type: 'application/json' });

        // @ts-ignore
        const preview = await smartExpenseImportService.analyzeFile(file, { defaultAccountId: 1 });

        expect(preview.kind).toBe('third-party');
        if (preview.kind === 'third-party') {
            expect(preview.rows.length).toBe(250);

            const firstRow = preview.rows[0];
            expect(firstRow.amount).toBe(118.6);
            expect(firstRow.category).toBe('Education');
            expect(firstRow.merchant).toBe('Shell Petrol');
            expect(firstRow.accountId).toBe(1);
            expect(firstRow.transactionType).toBe('expense');
        }
    });

    it('correctly handles different.json with alternative keys', async () => {
        const rootDir = path.resolve(process.cwd(), '..');
        const filePath = path.join(rootDir, 'tests', 'different.json');
        const jsonContent = fs.readFileSync(filePath, 'utf-8');

        const file = new File([jsonContent], 'different.json', { type: 'application/json' });

        // @ts-ignore
        const preview = await smartExpenseImportService.analyzeFile(file, { defaultAccountId: 1 });

        expect(preview.kind).toBe('third-party');
        if (preview.kind === 'third-party') {
            expect(preview.rows.length).toBe(3);

            const salaryRow = preview.rows[0];
            expect(salaryRow.amount).toBe(60000);
            expect(salaryRow.transactionType).toBe('income');
            expect(salaryRow.category).toBe('Salary');
            expect(salaryRow.description).toBe('Salary - Monthly salary');
        }
    });

    it('normalizes locale-formatted amounts, spreadsheet dates, and in-file duplicates', async () => {
        const payload = JSON.stringify([
            {
                date: 45292,
                amount: '1.234,56',
                description: 'Flight to Delhi',
                merchant: 'Air India',
                category: 'Travel',
                account: 'ICICI Savings'
            },
            {
                date: 45292,
                amount: '1.234,56',
                description: 'Flight to Delhi',
                merchant: 'Air India',
                category: 'Travel',
                account: 'ICICI Savings'
            }
        ]);

        const file = new File([payload], 'localized-import.json', { type: 'application/json' });

        // @ts-ignore
        const preview = await smartExpenseImportService.analyzeFile(file, { defaultAccountId: 1 });

        expect(preview.kind).toBe('third-party');
        if (preview.kind === 'third-party') {
            expect(preview.rows).toHaveLength(2);
            expect(preview.rows[0]?.amount).toBe(1234.56);
            expect(preview.rows[0]?.date).toBeInstanceOf(Date);
            expect(preview.rows[0]?.duplicate).toBe(false);
            expect(preview.rows[1]?.duplicate).toBe(true);
        }
    });
});
