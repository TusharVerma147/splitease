import mongoose, { Document, Schema } from 'mongoose';

export interface IGroupMember {
  userId: mongoose.Types.ObjectId;
  joinedAt: Date;
}

export interface IGroup extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  members: IGroupMember[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

groupSchema.index({ 'members.userId': 1 });

export const GroupModel = mongoose.model<IGroup>('Group', groupSchema);
