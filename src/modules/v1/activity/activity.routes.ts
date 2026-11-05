import { Router } from 'express';
import { activityController } from './activity.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';

const router = Router();

router.get('/', accessTokenMiddleware, (req, res) => { void activityController.getMyActivity(req, res); });

export default router;
