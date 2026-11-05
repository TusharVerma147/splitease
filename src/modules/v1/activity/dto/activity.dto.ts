import { z } from 'zod';
import { paginationQuerySchema } from '../../../../common/utils';

export const listActivityQueryDto = paginationQuerySchema.extend({
  sortBy: z.enum(['createdAt']).default('createdAt'),
});

export type ListActivityQueryDto = z.infer<typeof listActivityQueryDto>;
