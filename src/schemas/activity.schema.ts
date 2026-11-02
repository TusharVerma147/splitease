import mongoose, { Document, Schema } from 'mongoose';
import { ActivityType } from '../enum/enum';

export interface IActivity extends Document {
  userIds: mongoose.Types.ObjectId[];
  groupId: mongoose.Types.ObjectId;
  type: ActivityType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    groupId: { type: Schema.Types.ObjectId, required: true, ref: 'Group' },
    type: { type: String, enum: Object.values(ActivityType), required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

activitySchema.index({ userIds: 1, createdAt: -1 });

export const ActivityModel = mongoose.model<IActivity>('Activity', activitySchema);
