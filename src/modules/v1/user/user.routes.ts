import { Router } from 'express';
import { userController } from './user.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../common/utils';
import { updateMeDto, searchUserQueryDto } from './dto/user.dto';

const router = Router();

router.get('/me', accessTokenMiddleware, asyncHandler(userController.getMe));
router.patch('/me', accessTokenMiddleware, validate(updateMeDto), asyncHandler(userController.updateMe));
router.get(
  '/search',
  accessTokenMiddleware,
  validate(searchUserQueryDto, 'query'),
  asyncHandler(userController.searchByEmail),
);

export default router;
