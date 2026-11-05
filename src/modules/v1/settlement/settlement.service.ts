import { Types } from 'mongoose';
import { SettlementRepository } from '../../../repositories/settlement.repository';
import { GroupRepository } from '../../../repositories/group.repository';
import { Errors } from '../../../common/errors';
import { redisService } from '../../../providers/redis/redis.service';
import { publishEvent } from '../../../providers/rabbitmq/rabbitmq.publisher';
import { QueueName, EventType } from '../../../enum/enum';
import { paginated, PaginatedData } from '../../../common/responses';
import { parsePagination } from '../../../common/utils';
import { ISettlement } from '../../../schemas/settlement.schema';
import { CreateSettlementDto, ListSettlementsQueryDto } from './dto/settlement.dto';
import { SettlementView } from './interface/settlement.interface';

const settlementRepo = new SettlementRepository();
const groupRepo = new GroupRepository();

function toSettlementView(s: ISettlement): SettlementView {
  return {
    id: String(s._id),
    groupId: String(s.groupId),
    fromUserId: String(s.fromUserId),
    toUserId: String(s.toUserId),
    amount: s.amount,
    note: s.note,
    createdAt: s.createdAt,
  };
}

export class SettlementService {
  async createSettlement(groupId: string, data: CreateSettlementDto, actorId: string): Promise<SettlementView> {
    const group = await groupRepo.findActiveById(groupId);
    if (!group) throw Errors.notFound('Group');

    const memberIds = group.members.map((m) => String(m.userId));
    if (!memberIds.includes(data.fromUserId)) throw Errors.notGroupMember('fromUserId is not a member of this group');
    if (!memberIds.includes(data.toUserId)) throw Errors.notGroupMember('toUserId is not a member of this group');

    const settlement = await settlementRepo.create({
      groupId: new Types.ObjectId(groupId),
      fromUserId: new Types.ObjectId(data.fromUserId),
      toUserId: new Types.ObjectId(data.toUserId),
      amount: data.amount,
      note: data.note,
    });

    await redisService.bumpBalanceVersion(groupId);
    await publishEvent([QueueName.BALANCE_RECALCULATE, QueueName.NOTIFICATION], EventType.SETTLEMENT_CREATED, {
      groupId,
      settlementId: String(settlement._id),
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      amount: data.amount,
      actorId,
    });

    return toSettlementView(settlement);
  }

  async listSettlements(groupId: string, query: ListSettlementsQueryDto): Promise<PaginatedData<SettlementView>> {
    const { page, limit, skip } = parsePagination(query);
    const { items, total } = await settlementRepo.listByGroup(groupId, skip, limit, query.sortBy, query.order);
    return paginated(items.map(toSettlementView), total, page, limit);
  }
}

export const settlementService = new SettlementService();
