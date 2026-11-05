import { Types } from 'mongoose';
import { ActivityModel, IActivity } from '../schemas/activity.schema';
import { BaseRepository } from './base.repository';
import { ActivityType } from '../enum/enum';

export class ActivityRepository extends BaseRepository<IActivity> {
  constructor() {
    super(ActivityModel);
  }

  /** Idempotent: a redelivered queue message (same messageId) never creates a second activity. */
  async createIfAbsent(data: {
    messageId: string;
    userIds: string[];
    groupId: string;
    type: ActivityType;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.model
      .updateOne(
        { messageId: data.messageId },
        {
          $setOnInsert: {
            messageId: data.messageId,
            userIds: data.userIds.map((id) => new Types.ObjectId(id)),
            groupId: new Types.ObjectId(data.groupId),
            type: data.type,
            payload: data.payload,
          },
        },
        { upsert: true, timestamps: true },
      )
      .exec();
  }

  async listForUser(
    userId: string,
    skip: number,
    limit: number,
    order: 'asc' | 'desc',
  ): Promise<{ items: IActivity[]; total: number }> {
    const filter = { userIds: new Types.ObjectId(userId) };
    const direction = order === 'asc' ? 1 : -1;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: direction, _id: direction }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
