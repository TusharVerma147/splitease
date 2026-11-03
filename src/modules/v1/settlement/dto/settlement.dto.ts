import { z } from 'zod';

export const createSettlementDto = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: z.number().int().positive(),
  note: z.string().max(200).optional(),
});

export type CreateSettlementDto = z.infer<typeof createSettlementDto>;
