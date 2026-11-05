import { z } from 'zod';

export const updateMeDto = z.object({
  name: z.string().trim().min(2).max(100),
});

export const searchUserQueryDto = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export type UpdateMeDto = z.infer<typeof updateMeDto>;
export type SearchUserQueryDto = z.infer<typeof searchUserQueryDto>;
