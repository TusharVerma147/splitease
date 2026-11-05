import { z } from 'zod';
import { SplitType } from '../../../../enum/enum';
import { idParams, objectIdSchema, paginationQuerySchema } from '../../../../common/utils';

const splitItemDto = z.object({
  userId: objectIdSchema,
  share: z.number().int().positive().optional(),
  percent: z.number().gt(0).max(100).optional(),
});

const dateString = z.string().refine((d) => !Number.isNaN(Date.parse(d)), 'must be a valid date');

const baseExpenseDto = z.object({
  description: z.string().trim().min(1).max(200),
  amount: z.number().int().positive().max(100_000_000_000),
  paidBy: objectIdSchema,
  splitType: z.nativeEnum(SplitType),
  participants: z.array(objectIdSchema).min(1).max(100).optional(),
  splits: z.array(splitItemDto).min(1).max(100).optional(),
  expenseDate: dateString,
});

export const createExpenseDto = baseExpenseDto.refine(
  (data) => {
    if (data.splitType === SplitType.EQUAL) return !!data.participants?.length;
    return !!data.splits?.length;
  },
  { message: 'participants required for EQUAL, splits required for EXACT/PERCENT' },
);

export const updateExpenseDto = baseExpenseDto
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'at least one field is required' });

export const listExpensesQueryDto = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  paidBy: objectIdSchema.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  sortBy: z.enum(['expenseDate', 'amount', 'createdAt', 'description']).default('expenseDate'),
});

export const groupParamsDto = idParams('groupId');
export const expenseParamsDto = idParams('groupId', 'expenseId');

export type CreateExpenseDto = z.infer<typeof baseExpenseDto>;
export type UpdateExpenseDto = z.infer<typeof updateExpenseDto>;
export type ListExpensesQueryDto = z.infer<typeof listExpensesQueryDto>;
