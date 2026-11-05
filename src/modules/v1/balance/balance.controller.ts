import { Request, Response } from 'express';
import { balanceService } from './balance.service';
import { sendSuccess } from '../../../common/responses';

export class BalanceController {
  getGroupBalances = async (req: Request, res: Response): Promise<void> => {
    const result = await balanceService.getGroupBalances(req.params['groupId'] ?? '');
    sendSuccess(res, result, 'Balances fetched');
  };

  getMyBalances = async (req: Request, res: Response): Promise<void> => {
    const result = await balanceService.getMyBalances(req.user?.userId ?? '');
    sendSuccess(res, result, 'My balances fetched');
  };
}

export const balanceController = new BalanceController();
