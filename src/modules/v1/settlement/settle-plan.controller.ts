import { Request, Response } from 'express';
import { settlePlanService } from './settle-plan.service';
import { sendSuccess, sendError } from '../../../common/responses';
import { AppError } from '../../../common/errors';

export class SettlePlanController {
  async getSettlePlan(req: Request, res: Response): Promise<void> {
    try {
      const payments = await settlePlanService.getSettlePlan(req.params['groupId']!);
      sendSuccess(res, { payments }, 'Settle plan calculated');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }
}

export const settlePlanController = new SettlePlanController();
