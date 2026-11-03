import { Router } from 'express';
import authRoutes from './modules/v1/auth/auth.routes';
import userRoutes from './modules/v1/user/user.routes';
import groupRoutes from './modules/v1/group/group.routes';
import expenseRoutes from './modules/v1/expense/expense.routes';
import balanceRoutes, { groupBalanceRouter } from './modules/v1/balance/balance.routes';
import settlementRoutes from './modules/v1/settlement/settlement.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/groups', groupRoutes);
router.use('/groups/:groupId/expenses', expenseRoutes);
router.use('/groups/:groupId/balances', groupBalanceRouter());
router.use('/groups/:groupId/settlements', settlementRoutes);
router.use('/balances', balanceRoutes);

export default router;
