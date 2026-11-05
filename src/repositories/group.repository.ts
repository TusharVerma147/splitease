import { Types } from 'mongoose';
import { GroupModel, IGroup } from '../schemas/group.schema';
import { BaseRepository } from './base.repository';

export class GroupRepository extends BaseRepository<IGroup> {
  constructor() {
    super(GroupModel);
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const count = await this.model
      .countDocuments({
        _id: new Types.ObjectId(groupId),
        'members.userId': new Types.ObjectId(userId),
        isArchived: false,
      })
      .exec();
    return count > 0;
  }

  async createWithOwner(name: string, userId: string): Promise<IGroup> {
    const owner = new Types.ObjectId(userId);
    return this.model.create({ name, createdBy: owner, members: [{ userId: owner, joinedAt: new Date() }] });
  }

  async findActiveById(groupId: string): Promise<IGroup | null> {
    return this.model.findOne({ _id: new Types.ObjectId(groupId), isArchived: false }).exec();
  }

  async findUserGroupsPaged(
    userId: string,
    skip: number,
    limit: number,
    sortBy: string,
    order: 'asc' | 'desc',
  ): Promise<{ items: IGroup[]; total: number }> {
    const filter = { 'members.userId': new Types.ObjectId(userId), isArchived: false };
    const direction = order === 'asc' ? 1 : -1;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ [sortBy]: direction, _id: direction })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findUserGroups(userId: string): Promise<IGroup[]> {
    return this.model
      .find({ 'members.userId': new Types.ObjectId(userId), isArchived: false })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async rename(groupId: string, name: string): Promise<IGroup | null> {
    return this.model
      .findOneAndUpdate({ _id: new Types.ObjectId(groupId), isArchived: false }, { name }, { new: true })
      .exec();
  }

  /** Adds the member only if not already present (atomic, safe against double-adds). */
  async addMember(groupId: string, userId: string): Promise<IGroup | null> {
    const uid = new Types.ObjectId(userId);
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(groupId), isArchived: false, 'members.userId': { $ne: uid } },
        { $push: { members: { userId: uid, joinedAt: new Date() } } },
        { new: true },
      )
      .exec();
  }

  async removeMember(groupId: string, userId: string): Promise<IGroup | null> {
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(groupId), isArchived: false },
        { $pull: { members: { userId: new Types.ObjectId(userId) } } },
        { new: true },
      )
      .exec();
  }
}
