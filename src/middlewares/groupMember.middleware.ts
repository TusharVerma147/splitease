import { Errors } from '../common/errors';
import { asyncHandler, objectIdSchema } from '../common/utils';
import { GroupRepository } from '../repositories/group.repository';

const groupRepo = new GroupRepository();

/** The authenticated user must belong to :groupId. */
export const groupMemberMiddleware = asyncHandler(async (req, _res, next) => {
  const groupId = req.params['groupId'];
  const userId = req.user?.userId;
  if (!userId) throw Errors.unauthorized();

  if (!groupId || !objectIdSchema.safeParse(groupId).success) {
    throw Errors.validationError('params.groupId: must be a valid id');
  }

  const isMember = await groupRepo.isMember(groupId, userId);
  if (!isMember) throw Errors.notGroupMember();

  next();
});
