import { Router } from 'express';
import { balanceController } from './balance.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';

const router = Router();

router.get('/me', accessTokenMiddleware, (req, res) => { void balanceController.getMyBalances(req, res); });

export default router;

export function groupBalanceRouter(): Router {
  const r = Router({ mergeParams: true });
  r.get('/', accessTokenMiddleware, groupMemberMiddleware, (req, res) => { void balanceController.getGroupBalances(req, res); });
  return r;
}
