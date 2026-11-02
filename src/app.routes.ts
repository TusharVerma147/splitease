import { Router } from 'express';
import authRoutes from './modules/v1/auth/auth.routes';
import userRoutes from './modules/v1/user/user.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;
