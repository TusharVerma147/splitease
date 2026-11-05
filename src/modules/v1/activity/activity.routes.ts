import { Router } from 'express';
import { activityController } from './activity.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../common/utils';
import { listActivityQueryDto } from './dto/activity.dto';

const router = Router();

router.get(
  '/',
  accessTokenMiddleware,
  validate(listActivityQueryDto, 'query'),
  asyncHandler(activityController.getMyActivity),
);

export default router;
