import { Router } from 'express';
import authRoutes from './modules/v1/auth/auth.routes';
import userRoutes from './modules/v1/user/user.routes';
import groupRoutes from './modules/v1/group/group.routes';
import expenseRoutes from './modules/v1/expense/expense.routes';
import balanceRoutes, { groupBalanceRouter } from './modules/v1/balance/balance.routes';
import settlementRoutes from './modules/v1/settlement/settlement.routes';
import { settlePlanController } from './modules/v1/settlement/settle-plan.controller';
import activityRoutes from './modules/v1/activity/activity.routes';
import { groupExportRouter, exportRouter } from './modules/v1/export/export.routes';
import { accessTokenMiddleware } from './middlewares/accessToken.middleware';
import { groupMemberMiddleware } from './middlewares/groupMember.middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/groups', groupRoutes);
router.use('/groups/:groupId/expenses', expenseRoutes);
router.use('/groups/:groupId/balances', groupBalanceRouter());
router.use('/groups/:groupId/settlements', settlementRoutes);
router.use('/groups/:groupId/exports', groupExportRouter);
router.get('/groups/:groupId/settle-plan', accessTokenMiddleware, groupMemberMiddleware, (req, res) => {
  void settlePlanController.getSettlePlan(req, res);
});
router.use('/balances', balanceRoutes);
router.use('/activity', activityRoutes);
router.use('/exports', exportRouter);

export default router;
