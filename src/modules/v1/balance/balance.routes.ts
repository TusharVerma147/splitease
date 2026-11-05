import { Router } from 'express';
import { balanceController } from './balance.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';
import { asyncHandler } from '../../../common/utils';

/** Mounted at /balances */
const router = Router();
router.get('/me', accessTokenMiddleware, asyncHandler(balanceController.getMyBalances));

/** Mounted at /groups/:groupId/balances */
export const groupBalanceRouter = Router({ mergeParams: true });
groupBalanceRouter.get(
  '/',
  accessTokenMiddleware,
  groupMemberMiddleware,
  asyncHandler(balanceController.getGroupBalances),
);

export default router;
