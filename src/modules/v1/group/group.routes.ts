import { Router } from 'express';
import { groupController } from './group.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../common/utils';
import {
  createGroupDto,
  updateGroupDto,
  addMemberDto,
  listGroupsQueryDto,
  removeMemberParamsDto,
} from './dto/group.dto';

const router = Router();

router.post('/', accessTokenMiddleware, validate(createGroupDto), asyncHandler(groupController.createGroup));
router.get(
  '/',
  accessTokenMiddleware,
  validate(listGroupsQueryDto, 'query'),
  asyncHandler(groupController.getMyGroups),
);
router.get('/:groupId', accessTokenMiddleware, groupMemberMiddleware, asyncHandler(groupController.getGroup));
router.patch(
  '/:groupId',
  accessTokenMiddleware,
  groupMemberMiddleware,
  validate(updateGroupDto),
  asyncHandler(groupController.updateGroup),
);
router.post(
  '/:groupId/members',
  accessTokenMiddleware,
  groupMemberMiddleware,
  validate(addMemberDto),
  asyncHandler(groupController.addMember),
);
router.delete(
  '/:groupId/members/:userId',
  accessTokenMiddleware,
  groupMemberMiddleware,
  validate(removeMemberParamsDto, 'params'),
  asyncHandler(groupController.removeMember),
);

export default router;
