import { Request, Response } from 'express';
import { settlementService } from './settlement.service';
import { settlePlanService } from './settle-plan.service';
import { sendSuccess } from '../../../common/responses';
import { CreateSettlementDto, ListSettlementsQueryDto } from './dto/settlement.dto';

export class SettlementController {
  createSettlement = async (req: Request, res: Response): Promise<void> => {
    const settlement = await settlementService.createSettlement(
      req.params['groupId'] ?? '',
      req.body as CreateSettlementDto,
      req.user?.userId ?? '',
    );
    sendSuccess(res, settlement, 'Settlement recorded', 201);
  };

  listSettlements = async (req: Request, res: Response): Promise<void> => {
    const result = await settlementService.listSettlements(
      req.params['groupId'] ?? '',
      req.query as unknown as ListSettlementsQueryDto,
    );
    sendSuccess(res, result, 'Settlements fetched');
  };

  getSettlePlan = async (req: Request, res: Response): Promise<void> => {
    const payments = await settlePlanService.getSettlePlan(req.params['groupId'] ?? '');
    sendSuccess(res, { payments }, 'Settle plan calculated');
  };
}

export const settlementController = new SettlementController();
