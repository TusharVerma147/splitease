import { Request, Response } from 'express';
import { balanceService } from './balance.service';
import { sendSuccess, sendError } from '../../../common/responses';
import { AppError } from '../../../common/errors';

export class BalanceController {
  async getGroupBalances(req: Request, res: Response): Promise<void> {
    try {
      const result = await balanceService.getGroupBalances(req.params['groupId']!);
      sendSuccess(res, result, 'Balances fetched');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async getMyBalances(req: Request, res: Response): Promise<void> {
    try {
      const balances = await balanceService.getMyBalances(req.user!.userId);
      sendSuccess(res, { balances }, 'My balances fetched');
    } catch (err) {
      sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }
}

export const balanceController = new BalanceController();
