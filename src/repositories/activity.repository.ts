import { ActivityModel, IActivity } from '../schemas/activity.schema';
import { BaseRepository } from './base.repository';
import { ActivityType } from '../enum/enum';
import mongoose from 'mongoose';

export class ActivityRepository extends BaseRepository<IActivity> {
  constructor() {
    super(ActivityModel);
  }

  async createActivity(data: {
    userIds: string[];
    groupId: string;
    type: ActivityType;
    payload: Record<string, unknown>;
  }): Promise<IActivity> {
    return this.model.create({
      userIds: data.userIds.map((id) => new mongoose.Types.ObjectId(id)),
      groupId: new mongoose.Types.ObjectId(data.groupId),
      type: data.type,
      payload: data.payload,
    });
  }

  async listForUser(
    userId: string,
    skip: number,
    limit: number,
  ): Promise<{ items: IActivity[]; total: number }> {
    const filter = { userIds: new mongoose.Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
