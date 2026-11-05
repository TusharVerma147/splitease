import { Types } from 'mongoose';
import { ExportModel, IExport } from '../schemas/export.schema';
import { BaseRepository } from './base.repository';
import { ExportStatus } from '../enum/enum';

export class ExportRepository extends BaseRepository<IExport> {
  constructor() {
    super(ExportModel);
  }

  async createQueued(groupId: string, requestedBy: string): Promise<IExport> {
    return this.model.create({
      groupId: new Types.ObjectId(groupId),
      requestedBy: new Types.ObjectId(requestedBy),
      status: ExportStatus.QUEUED,
    });
  }

  async updateStatus(
    exportId: string,
    status: ExportStatus,
    extra?: { filePath?: string; error?: string },
  ): Promise<IExport | null> {
    return this.model.findByIdAndUpdate(exportId, { status, ...extra }, { new: true }).exec();
  }
}
