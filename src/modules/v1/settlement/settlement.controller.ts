import { Request, Response } from 'express';
import { settlementService } from './settlement.service';
import { sendSuccess, sendError } from '../../../common/responses';
import { AppError } from '../../../common/errors';
import { CreateSettlementDto } from './dto/settlement.dto';

export class SettlementController {
  async createSettlement(req: Request, res: Response): Promise<void> {
    try {
      const settlement = await settlementService.createSettlement(
        req.params['groupId']!,
        req.body as CreateSettlementDto,
      );
      sendSuccess(res, { settlement }, 'Settlement recorded', 201);
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async listSettlements(req: Request, res: Response): Promise<void> {
    try {
      const result = await settlementService.listSettlements(
        req.params['groupId']!,
        req.query as Record<string, unknown>,
      );
      sendSuccess(res, result, 'Settlements fetched');
    } catch (err) {
      sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }
}

export const settlementController = new SettlementController();
