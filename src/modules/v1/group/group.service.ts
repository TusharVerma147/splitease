import { GroupRepository } from '../../../repositories/group.repository';
import { UserRepository } from '../../../repositories/user.repository';
import { Errors } from '../../../common/errors';
import { parsePagination } from '../../../common/utils';
import { paginated, PaginatedData } from '../../../common/responses';
import { IGroup } from '../../../schemas/group.schema';
import { redisService } from '../../../providers/redis/redis.service';
import { publishEvent } from '../../../providers/rabbitmq/rabbitmq.publisher';
import { QueueName, EventType } from '../../../enum/enum';
import { balanceService } from '../balance/balance.service';
import { GroupListItem, GroupView } from './interface/group.interface';
import { ListGroupsQueryDto } from './dto/group.dto';

const groupRepo = new GroupRepository();
const userRepo = new UserRepository();

async function toGroupView(group: IGroup): Promise<GroupView> {
  const users = await userRepo.findByIds(group.members.map((m) => m.userId));
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return {
    id: String(group._id),
    name: group.name,
    createdBy: String(group.createdBy),
    isArchived: group.isArchived,
    members: group.members.map((m) => {
      const user = byId.get(String(m.userId));
      return {
        userId: String(m.userId),
        name: user?.name ?? 'Unknown',
        email: user?.email ?? '',
        joinedAt: m.joinedAt,
      };
    }),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export class GroupService {
  async createGroup(name: string, userId: string): Promise<GroupView> {
    const group = await groupRepo.createWithOwner(name, userId);
    return toGroupView(group);
  }

  async getMyGroups(userId: string, query: ListGroupsQueryDto): Promise<PaginatedData<GroupListItem>> {
    const { page, limit, skip } = parsePagination(query);
    const { items, total } = await groupRepo.findUserGroupsPaged(userId, skip, limit, query.sortBy, query.order);

    const rows = await Promise.all(
      items.map(async (group): Promise<GroupListItem> => {
        const { balances, stale } = await balanceService.getGroupBalances(String(group._id));
        return {
          id: String(group._id),
          name: group.name,
          memberCount: group.members.length,
          myBalance: balances.find((b) => b.userId === userId)?.net ?? 0,
          stale,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        };
      }),
    );
    return paginated(rows, total, page, limit);
  }

  async getGroup(groupId: string): Promise<GroupView> {
    const group = await groupRepo.findActiveById(groupId);
    if (!group) throw Errors.notFound('Group');
    return toGroupView(group);
  }

  async updateGroup(groupId: string, name: string): Promise<GroupView> {
    const group = await groupRepo.rename(groupId, name);
    if (!group) throw Errors.notFound('Group');
    return toGroupView(group);
  }

  async addMember(groupId: string, email: string, requesterId: string): Promise<GroupView> {
    const user = await userRepo.findByEmail(email);
    if (!user || !user.isActive) throw Errors.notFound('User');

    const group = await groupRepo.addMember(groupId, String(user._id));
    if (!group) {
      // Atomic add found nothing to add to: the user is already in the group.
      if (await groupRepo.isMember(groupId, String(user._id))) throw Errors.alreadyMember();
      throw Errors.notFound('Group');
    }

    await redisService.bumpBalanceVersion(groupId);
    await publishEvent([QueueName.NOTIFICATION, QueueName.BALANCE_RECALCULATE], EventType.MEMBER_ADDED, {
      groupId,
      userId: String(user._id),
      addedBy: requesterId,
    });

    return toGroupView(group);
  }

  /** A member can only leave the group when their balance is exactly 0. */
  async removeMember(groupId: string, userId: string): Promise<void> {
    const group = await groupRepo.findActiveById(groupId);
    if (!group) throw Errors.notFound('Group');
    if (!group.members.some((m) => String(m.userId) === userId)) throw Errors.notFound('Member');

    // Always check against fresh data: the Redis cache may be stale.
    const balances = await balanceService.calculateGroupBalances(groupId);
    const balance = balances.find((b) => b.userId === userId);
    if (balance && balance.net !== 0) throw Errors.balanceNotSettled();

    await groupRepo.removeMember(groupId, userId);
    await redisService.bumpBalanceVersion(groupId);
    await publishEvent([QueueName.BALANCE_RECALCULATE], EventType.MEMBER_REMOVED, { groupId, removedUserId: userId });
  }
}

export const groupService = new GroupService();
