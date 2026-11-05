import { balanceService } from '../balance/balance.service';
import { workerThreadService } from '../../../providers/workerThread/worker-thread.service';
import type { DebtBalance, DebtPayment } from '../../../providers/workerThread/simplifyDebts.worker';
import { Payment } from './interface/settlement.interface';

export class SettlePlanService {
  /** Fewest payments that clear the group. The search runs on a worker thread. */
  async getSettlePlan(groupId: string): Promise<Payment[]> {
    // A plan must reflect reality, so it uses fresh balances rather than the cache.
    const balances = await balanceService.calculateGroupBalances(groupId);
    return workerThreadService.runTask<DebtBalance[], DebtPayment[]>(
      'simplifyDebts',
      balances.map((b) => ({ userId: b.userId, net: b.net })),
    );
  }
}

export const settlePlanService = new SettlePlanService();
