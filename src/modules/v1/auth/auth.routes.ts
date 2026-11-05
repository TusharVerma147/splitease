import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { refreshTokenMiddleware } from '../../../middlewares/refreshToken.middleware';
import { loginRateLimit } from '../../../middlewares/rateLimit.middleware';
import { asyncHandler } from '../../../common/utils';
import { registerDto, loginDto } from './dto/auth.dto';

const router = Router();

router.post('/register', validate(registerDto), asyncHandler(authController.register));
router.post('/login', loginRateLimit, validate(loginDto), asyncHandler(authController.login));
router.post('/refresh', refreshTokenMiddleware, asyncHandler(authController.refresh));
router.post('/logout', accessTokenMiddleware, asyncHandler(authController.logout));
router.post('/logout-all', accessTokenMiddleware, asyncHandler(authController.logoutAll));
router.get('/sessions', accessTokenMiddleware, asyncHandler(authController.sessions));

export default router;
