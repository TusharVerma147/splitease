import { GroupModel, IGroup } from '../schemas/group.schema';
import { BaseRepository } from './base.repository';
import mongoose from 'mongoose';

export class GroupRepository extends BaseRepository<IGroup> {
  constructor() {
    super(GroupModel);
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const count = await this.model
      .countDocuments({
        _id: new mongoose.Types.ObjectId(groupId),
        'members.userId': new mongoose.Types.ObjectId(userId),
        isArchived: false,
      })
      .exec();
    return count > 0;
  }

  async findUserGroups(userId: string): Promise<IGroup[]> {
    return this.model
      .find({ 'members.userId': new mongoose.Types.ObjectId(userId), isArchived: false })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async addMember(groupId: string, userId: string): Promise<IGroup | null> {
    return this.model
      .findByIdAndUpdate(
        groupId,
        { $push: { members: { userId: new mongoose.Types.ObjectId(userId), joinedAt: new Date() } } },
        { new: true },
      )
      .exec();
  }

  async removeMember(groupId: string, userId: string): Promise<IGroup | null> {
    return this.model
      .findByIdAndUpdate(
        groupId,
        { $pull: { members: { userId: new mongoose.Types.ObjectId(userId) } } },
        { new: true },
      )
      .exec();
  }
}
