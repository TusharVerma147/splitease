import { z } from 'zod';
import { idParams, objectIdSchema, paginationQuerySchema } from '../../../../common/utils';

export const createSettlementDto = z
  .object({
    fromUserId: objectIdSchema,
    toUserId: objectIdSchema,
    amount: z.number().int().positive().max(100_000_000_000),
    note: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.fromUserId !== d.toUserId, { message: 'fromUserId and toUserId must differ' });

export const listSettlementsQueryDto = paginationQuerySchema.extend({
  sortBy: z.enum(['createdAt', 'amount']).default('createdAt'),
});

export const groupParamsDto = idParams('groupId');

export type CreateSettlementDto = z.infer<typeof createSettlementDto>;
export type ListSettlementsQueryDto = z.infer<typeof listSettlementsQueryDto>;
