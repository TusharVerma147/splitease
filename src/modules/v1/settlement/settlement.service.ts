import mongoose, { Types } from 'mongoose';
import { SettlementRepository } from '../../../repositories/settlement.repository';
import { GroupRepository } from '../../../repositories/group.repository';
import { Errors } from '../../../common/errors';
import { redisService } from '../../../providers/redis/redis.service';
import { publishToQueue, buildMessage } from '../../../providers/rabbitmq/rabbitmq.publisher';
import { QueueName, EventType } from '../../../enum/enum';
import { paginated } from '../../../common/responses';
import { parsePagination } from '../../../common/utils';
import { ISettlement } from '../../../schemas/settlement.schema';

const settlementRepo = new SettlementRepository();
const groupRepo = new GroupRepository();

export class SettlementService {
  async createSettlement(
    groupId: string,
    data: { fromUserId: string; toUserId: string; amount: number; note?: string },
  ): Promise<ISettlement> {
    const group = await groupRepo.findById(groupId);
    if (!group) throw Errors.notFound('Group');

    const memberIds = group.members.map((m) => String(m.userId));
    if (!memberIds.includes(data.fromUserId)) throw Errors.notGroupMember();
    if (!memberIds.includes(data.toUserId)) throw Errors.notGroupMember();

    const settlement = await settlementRepo.create({
      groupId: new Types.ObjectId(groupId) as unknown as mongoose.Types.ObjectId,
      fromUserId: new Types.ObjectId(data.fromUserId) as unknown as mongoose.Types.ObjectId,
      toUserId: new Types.ObjectId(data.toUserId) as unknown as mongoose.Types.ObjectId,
      amount: data.amount,
      note: data.note,
    });

    await redisService.invalidateGroupBalances(groupId);
    publishToQueue(QueueName.BALANCE_RECALCULATE, buildMessage(EventType.SETTLEMENT_CREATED, { groupId, settlementId: String(settlement._id) }));
    publishToQueue(QueueName.NOTIFICATION, buildMessage(EventType.SETTLEMENT_CREATED, { groupId, settlementId: String(settlement._id) }));

    return settlement;
  }

  async listSettlements(groupId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = parsePagination(query);
    const { items, total } = await settlementRepo.listByGroup(groupId, skip, limit);
    return paginated(items, total, page, limit);
  }
}

export const settlementService = new SettlementService();
