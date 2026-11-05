import { balanceService } from '../balance/balance.service';
import { runWorker } from '../../../providers/workerThread/worker-thread.service';

export interface Payment {
  from: string;
  to: string;
  amount: number;
}

export class SettlePlanService {
  async getSettlePlan(groupId: string): Promise<Payment[]> {
    const { balances } = await balanceService.getGroupBalances(groupId);

    const payments = await runWorker<Array<{ userId: string; net: number }>, Payment[]>(
      'simplifyDebts',
      balances.map((b) => ({ userId: b.userId, net: b.net })),
    );

    return payments;
  }
}

export const settlePlanService = new SettlePlanService();
