import mongoose from 'mongoose';
import { ExpenseModel } from '../../../schemas/expense.schema';
import { SettlementModel } from '../../../schemas/settlement.schema';
import { GroupRepository } from '../../../repositories/group.repository';
import { Errors } from '../../../common/errors';
import { redisService } from '../../../providers/redis/redis.service';

const groupRepo = new GroupRepository();

export interface MemberBalance {
  userId: string;
  name: string;
  net: number;
}

export interface GroupBalanceResult {
  groupId: string;
  balances: MemberBalance[];
  stale: boolean;
}

export class BalanceService {
  async calculateGroupBalances(groupId: string): Promise<MemberBalance[]> {
    const gid = new mongoose.Types.ObjectId(groupId);

    const expenseAgg = await ExpenseModel.aggregate([
      { $match: { groupId: gid, isDeleted: false } },
      {
        $facet: {
          paid: [{ $group: { _id: '$paidBy', totalPaid: { $sum: '$amount' } } }],
          owed: [
            { $unwind: '$splits' },
            { $group: { _id: '$splits.userId', totalOwed: { $sum: '$splits.share' } } },
          ],
        },
      },
    ]);

    const settlementAgg = await SettlementModel.aggregate([
      { $match: { groupId: gid } },
      {
        $facet: {
          paid: [{ $group: { _id: '$fromUserId', totalPaid: { $sum: '$amount' } } }],
          received: [{ $group: { _id: '$toUserId', totalReceived: { $sum: '$amount' } } }],
        },
      },
    ]);

    const data = expenseAgg[0] as {
      paid: Array<{ _id: mongoose.Types.ObjectId; totalPaid: number }>;
      owed: Array<{ _id: mongoose.Types.ObjectId; totalOwed: number }>;
    };

    const sData = settlementAgg[0] as {
      paid: Array<{ _id: mongoose.Types.ObjectId; totalPaid: number }>;
      received: Array<{ _id: mongoose.Types.ObjectId; totalReceived: number }>;
    };

    const netMap = new Map<string, number>();

    for (const p of data.paid) {
      const key = String(p._id);
      netMap.set(key, (netMap.get(key) ?? 0) + p.totalPaid);
    }
    for (const o of data.owed) {
      const key = String(o._id);
      netMap.set(key, (netMap.get(key) ?? 0) - o.totalOwed);
    }
    for (const sp of sData.paid) {
      const key = String(sp._id);
      netMap.set(key, (netMap.get(key) ?? 0) - sp.totalPaid);
    }
    for (const sr of sData.received) {
      const key = String(sr._id);
      netMap.set(key, (netMap.get(key) ?? 0) + sr.totalReceived);
    }

    const group = await groupRepo.findById(groupId);
    if (!group) throw Errors.notFound('Group');

    const UserModel = mongoose.model('User');
    const memberIds = group.members.map((m) => m.userId);
    const users = await UserModel.find({ _id: { $in: memberIds } }).select('name').lean();
    const nameMap = new Map<string, string>();
    for (const u of users as unknown as Array<{ _id: mongoose.Types.ObjectId; name: string }>) {
      nameMap.set(String(u._id), u.name);
    }

    return group.members.map((m) => ({
      userId: String(m.userId),
      name: nameMap.get(String(m.userId)) ?? 'Unknown',
      net: netMap.get(String(m.userId)) ?? 0,
    }));
  }

  async getGroupBalances(groupId: string): Promise<GroupBalanceResult> {
    const cached = await redisService.getGroupBalances(groupId);
    const stale = await redisService.isBalanceStale(groupId);

    if (cached && !stale) {
      return {
        groupId,
        balances: JSON.parse(cached) as MemberBalance[],
        stale: false,
      };
    }

    const balances = await this.calculateGroupBalances(groupId);
    await redisService.setGroupBalances(groupId, JSON.stringify(balances));
    await redisService.clearBalanceStale(groupId);

    return { groupId, balances, stale };
  }

  async getMyBalances(userId: string): Promise<{ groupId: string; groupName: string; net: number }[]> {
    const groups = await groupRepo.findUserGroups(userId);
    const results: { groupId: string; groupName: string; net: number }[] = [];

    for (const group of groups) {
      const { balances } = await this.getGroupBalances(String(group._id));
      const mine = balances.find((b) => b.userId === userId);
      results.push({
        groupId: String(group._id),
        groupName: group.name,
        net: mine?.net ?? 0,
      });
    }

    return results;
  }
}

export const balanceService = new BalanceService();
