import { Router } from 'express';
import { settlementController } from './settlement.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../common/utils';
import { createSettlementDto, listSettlementsQueryDto } from './dto/settlement.dto';

const guard = [accessTokenMiddleware, groupMemberMiddleware];

/** Mounted at /groups/:groupId/settlements */
const router = Router({ mergeParams: true });
router.post('/', ...guard, validate(createSettlementDto), asyncHandler(settlementController.createSettlement));
router.get(
  '/',
  ...guard,
  validate(listSettlementsQueryDto, 'query'),
  asyncHandler(settlementController.listSettlements),
);

/** Mounted at /groups/:groupId/settle-plan */
export const settlePlanRouter = Router({ mergeParams: true });
settlePlanRouter.get('/', ...guard, asyncHandler(settlementController.getSettlePlan));

export default router;
