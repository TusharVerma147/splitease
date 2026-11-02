import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { refreshTokenMiddleware } from '../../../middlewares/refreshToken.middleware';
import { loginRateLimit } from '../../../middlewares/rateLimit.middleware';
import { registerDto, loginDto } from './dto/auth.dto';

const router = Router();

router.post('/register', validate(registerDto), (req, res) => { void authController.register(req, res); });
router.post('/login', loginRateLimit, validate(loginDto), (req, res) => { void authController.login(req, res); });
router.post('/refresh', refreshTokenMiddleware, (req, res) => { void authController.refresh(req, res); });
router.post('/logout', accessTokenMiddleware, (req, res) => { void authController.logout(req, res); });
router.post('/logout-all', accessTokenMiddleware, (req, res) => { void authController.logoutAll(req, res); });
router.get('/sessions', accessTokenMiddleware, (req, res) => { void authController.sessions(req, res); });

export default router;
