import { Router } from 'express';
import { userController } from './user.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';

const router = Router();

router.get('/me', accessTokenMiddleware, (req, res) => { void userController.getMe(req, res); });
router.patch('/me', accessTokenMiddleware, (req, res) => { void userController.updateMe(req, res); });
router.get('/search', accessTokenMiddleware, (req, res) => { void userController.searchByEmail(req, res); });

export default router;
