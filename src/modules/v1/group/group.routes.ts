import { Router } from 'express';
import { groupController } from './group.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { createGroupDto, updateGroupDto, addMemberDto } from './dto/group.dto';

const router = Router();

router.post('/', accessTokenMiddleware, validate(createGroupDto), (req, res) => { void groupController.createGroup(req, res); });
router.get('/', accessTokenMiddleware, (req, res) => { void groupController.getMyGroups(req, res); });
router.get('/:groupId', accessTokenMiddleware, groupMemberMiddleware, (req, res) => { void groupController.getGroup(req, res); });
router.patch('/:groupId', accessTokenMiddleware, groupMemberMiddleware, validate(updateGroupDto), (req, res) => { void groupController.updateGroup(req, res); });
router.post('/:groupId/members', accessTokenMiddleware, groupMemberMiddleware, validate(addMemberDto), (req, res) => { void groupController.addMember(req, res); });
router.delete('/:groupId/members/:userId', accessTokenMiddleware, groupMemberMiddleware, (req, res) => { void groupController.removeMember(req, res); });

export default router;
