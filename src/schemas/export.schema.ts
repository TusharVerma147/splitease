import mongoose, { Document, Schema } from 'mongoose';
import { ExportStatus } from '../enum/enum';

export interface IExport extends Document {
  groupId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  status: ExportStatus;
  filePath?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const exportSchema = new Schema<IExport>(
  {
    groupId: { type: Schema.Types.ObjectId, required: true, ref: 'Group' },
    requestedBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    status: { type: String, enum: Object.values(ExportStatus), default: ExportStatus.QUEUED },
    filePath: { type: String },
    error: { type: String },
  },
  { timestamps: true },
);

exportSchema.index({ requestedBy: 1, createdAt: -1 });

export const ExportModel = mongoose.model<IExport>('Export', exportSchema);
