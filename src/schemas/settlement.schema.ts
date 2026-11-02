import mongoose, { Document, Schema } from 'mongoose';

export interface ISettlement extends Document {
  groupId: mongoose.Types.ObjectId;
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  amount: number;
  note?: string;
  createdAt: Date;
}

const settlementSchema = new Schema<ISettlement>(
  {
    groupId: { type: Schema.Types.ObjectId, required: true, ref: 'Group' },
    fromUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    toUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String },
  },
  { timestamps: true },
);

settlementSchema.index({ groupId: 1, createdAt: -1 });

export const SettlementModel = mongoose.model<ISettlement>('Settlement', settlementSchema);
