import { GroupRepository } from '../../../repositories/group.repository';
import { ExpenseRepository } from '../../../repositories/expense.repository';
import { SettlementRepository } from '../../../repositories/settlement.repository';
import { UserRepository } from '../../../repositories/user.repository';
import { Errors } from '../../../common/errors';
import { computeNetBalances } from '../../../common/utils';
import { redisService } from '../../../providers/redis/redis.service';
import { GroupBalanceResult, MemberBalance, MyBalancesResult } from './interface/balance.interface';

const groupRepo = new GroupRepository();
const expenseRepo = new ExpenseRepository();
const settlementRepo = new SettlementRepository();
const userRepo = new UserRepository();

export class BalanceService {
  /** Fresh balances straight from expenses + settlements (aggregation pipelines). */
  async calculateGroupBalances(groupId: string): Promise<MemberBalance[]> {
    const group = await groupRepo.findById(groupId);
    if (!group) throw Errors.notFound('Group');

    const [expenses, settlements, users] = await Promise.all([
      expenseRepo.totalsByGroup(groupId),
      settlementRepo.totalsByGroup(groupId),
      userRepo.findByIds(group.members.map((m) => m.userId)),
    ]);

    const net = computeNetBalances({
      expensePaid: expenses.paid,
      expenseOwed: expenses.owed,
      settlementPaid: settlements.paid,
      settlementReceived: settlements.received,
    });
    const names = new Map(users.map((u) => [String(u._id), u.name]));

    return group.members.map((m) => ({
      userId: String(m.userId),
      name: names.get(String(m.userId)) ?? 'Unknown',
      net: net.get(String(m.userId)) ?? 0,
    }));
  }

  /**
   * Recalculates and caches the balances. The version read *before* calculating is
   * stored with them, so a write that lands mid-calculation still shows as stale.
   */
  async refreshGroupBalances(groupId: string): Promise<MemberBalance[]> {
    const version = await redisService.getBalanceVersion(groupId);
    const balances = await this.calculateGroupBalances(groupId);
    await redisService.setGroupBalances(groupId, version, balances);
    return balances;
  }

  /** Served from the Redis cache. `stale` means a recalculation is still queued. */
  async getGroupBalances(groupId: string): Promise<GroupBalanceResult> {
    const [cached, version] = await Promise.all([
      redisService.getGroupBalances<MemberBalance>(groupId),
      redisService.getBalanceVersion(groupId),
    ]);
    if (cached) return { groupId, balances: cached.balances, stale: cached.version !== version };

    const balances = await this.refreshGroupBalances(groupId);
    return { groupId, balances, stale: false };
  }

  async getMyBalances(userId: string): Promise<MyBalancesResult> {
    const groups = await groupRepo.findUserGroups(userId);
    const perGroup = await Promise.all(
      groups.map(async (group) => {
        const { balances } = await this.getGroupBalances(String(group._id));
        const mine = balances.find((b) => b.userId === userId);
        return { groupId: String(group._id), groupName: group.name, net: mine?.net ?? 0 };
      }),
    );

    const totalOwe = perGroup.reduce((sum, g) => sum + (g.net < 0 ? -g.net : 0), 0);
    const totalOwed = perGroup.reduce((sum, g) => sum + (g.net > 0 ? g.net : 0), 0);
    return { totalOwe, totalOwed, net: totalOwed - totalOwe, groups: perGroup };
  }
}

export const balanceService = new BalanceService();
