import { Types } from 'mongoose';
import { GroupRepository } from '../../../repositories/group.repository';
import { UserRepository } from '../../../repositories/user.repository';
import { Errors } from '../../../common/errors';
import { IGroup } from '../../../schemas/group.schema';
import { redisService } from '../../../providers/redis/redis.service';
import { publishToQueue, buildMessage } from '../../../providers/rabbitmq/rabbitmq.publisher';
import { QueueName, EventType } from '../../../enum/enum';

const groupRepo = new GroupRepository();
const userRepo = new UserRepository();

export class GroupService {
  async createGroup(name: string, userId: string): Promise<IGroup> {
    const uid = new Types.ObjectId(userId);
    const group = await groupRepo.create({
      name,
      createdBy: uid as unknown as Types.ObjectId,
      members: [{ userId: uid as unknown as Types.ObjectId, joinedAt: new Date() }],
    });
    return group;
  }

  async getMyGroups(userId: string): Promise<IGroup[]> {
    return groupRepo.findUserGroups(userId);
  }

  async getGroup(groupId: string): Promise<IGroup> {
    const group = await groupRepo.findById(groupId);
    if (!group || group.isArchived) throw Errors.notFound('Group');
    return group;
  }

  async updateGroup(groupId: string, name: string): Promise<IGroup> {
    const group = await groupRepo.updateById(groupId, { name });
    if (!group) throw Errors.notFound('Group');
    return group;
  }

  async addMember(groupId: string, email: string, requesterId: string): Promise<IGroup> {
    const user = await userRepo.findByEmail(email);
    if (!user) throw Errors.notFound('User');

    const isMember = await groupRepo.isMember(groupId, String(user._id));
    if (isMember) throw Errors.alreadyMember();

    const group = await groupRepo.addMember(groupId, String(user._id));
    if (!group) throw Errors.notFound('Group');

    publishToQueue(
      QueueName.NOTIFICATION,
      buildMessage(EventType.MEMBER_ADDED, {
        groupId,
        userId: String(user._id),
        addedBy: requesterId,
      }),
    );

    return group;
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    const balancesRaw = await redisService.getGroupBalances(groupId);
    if (balancesRaw) {
      const balances = JSON.parse(balancesRaw) as Array<{ userId: string; net: number }>;
      const memberBalance = balances.find((b) => b.userId === userId);
      if (memberBalance && memberBalance.net !== 0) throw Errors.balanceNotSettled();
    }

    const group = await groupRepo.removeMember(groupId, userId);
    if (!group) throw Errors.notFound('Group');
  }
}

export const groupService = new GroupService();
