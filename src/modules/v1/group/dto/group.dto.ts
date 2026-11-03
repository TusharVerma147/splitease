import { z } from 'zod';

export const createGroupDto = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const updateGroupDto = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const addMemberDto = z.object({
  email: z.string().email().toLowerCase(),
});

export type CreateGroupDto = z.infer<typeof createGroupDto>;
export type UpdateGroupDto = z.infer<typeof updateGroupDto>;
export type AddMemberDto = z.infer<typeof addMemberDto>;
