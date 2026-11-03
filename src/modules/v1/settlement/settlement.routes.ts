import { Router } from 'express';
import { settlementController } from './settlement.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { createSettlementDto } from './dto/settlement.dto';

const router = Router({ mergeParams: true });

router.post('/', accessTokenMiddleware, groupMemberMiddleware, validate(createSettlementDto), (req, res) => { void settlementController.createSettlement(req, res); });
router.get('/', accessTokenMiddleware, groupMemberMiddleware, (req, res) => { void settlementController.listSettlements(req, res); });

export default router;
