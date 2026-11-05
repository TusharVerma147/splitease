import { z } from 'zod';
import { idParams, paginationQuerySchema } from '../../../../common/utils';

export const createGroupDto = z.object({
  name: z.string().trim().min(1).max(100),
});

export const updateGroupDto = z.object({
  name: z.string().trim().min(1).max(100),
});

export const addMemberDto = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const listGroupsQueryDto = paginationQuerySchema.extend({
  sortBy: z.enum(['updatedAt', 'createdAt', 'name']).default('updatedAt'),
});

export const groupIdParamsDto = idParams('groupId');
export const removeMemberParamsDto = idParams('groupId', 'userId');

export type CreateGroupDto = z.infer<typeof createGroupDto>;
export type UpdateGroupDto = z.infer<typeof updateGroupDto>;
export type AddMemberDto = z.infer<typeof addMemberDto>;
export type ListGroupsQueryDto = z.infer<typeof listGroupsQueryDto>;
