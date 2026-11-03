import { z } from 'zod';
import { SplitType } from '../../../../enum/enum';

const splitItemDto = z.object({
  userId: z.string().min(1),
  share: z.number().int().positive().optional(),
  percent: z.number().positive().max(100).optional(),
});

const baseExpenseDto = z.object({
  description: z.string().min(1).max(200).trim(),
  amount: z.number().int().positive(),
  paidBy: z.string().min(1),
  splitType: z.nativeEnum(SplitType),
  participants: z.array(z.string().min(1)).min(1).optional(),
  splits: z.array(splitItemDto).min(1).optional(),
  expenseDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
});

export const createExpenseDto = baseExpenseDto.refine((data) => {
  if (data.splitType === SplitType.EQUAL) return !!data.participants && data.participants.length > 0;
  return !!data.splits && data.splits.length > 0;
}, { message: 'participants required for EQUAL, splits required for EXACT/PERCENT' });

export const updateExpenseDto = baseExpenseDto.partial();

export type CreateExpenseDto = z.infer<typeof createExpenseDto>;
export type UpdateExpenseDto = z.infer<typeof updateExpenseDto>;
