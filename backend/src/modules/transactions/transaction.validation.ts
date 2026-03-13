import { z } from '../../middleware/validate';

const TransactionTypeSchema = z.enum(['income', 'expense', 'transfer']);

const AmountSchema = z
  .coerce
  .number()
  .positive({ message: 'Amount must be greater than 0' })
  .max(999999999, { message: 'Amount exceeds maximum limit' })
  .transform((value) => Number(value.toFixed(2)));

const DateSchema = z.coerce.date();

export const transactionCreateSchema = z.object({
  accountId: z.string().trim().min(1, 'Account is required'),
  type: TransactionTypeSchema,
  amount: AmountSchema,
  category: z.string().trim().min(1, 'Category is required').max(80),
  subcategory: z.string().trim().max(80).optional(),
  description: z.string().trim().max(200).optional(),
  merchant: z.string().trim().max(120).optional(),
  date: DateSchema,
  tags: z.array(z.string().trim().max(40)).optional(),
  transferToAccountId: z.string().trim().min(1).optional(),
  transferType: z.enum(['self-transfer', 'other-transfer']).optional(),
});

export const transactionCreateValidatedSchema = transactionCreateSchema.superRefine((data, ctx) => {
  if (data.type === 'transfer' && !data.transferToAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'transferToAccountId is required for transfer transactions',
      path: ['transferToAccountId'],
    });
  }
});

export const transactionUpdateSchema = transactionCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required for update' }
);

export const transactionQuerySchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  category: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const transactionIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const transactionAccountParamSchema = z.object({
  accountId: z.string().trim().min(1),
});
