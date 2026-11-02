import { ExportModel, IExport } from '../schemas/export.schema';
import { BaseRepository } from './base.repository';
import { ExportStatus } from '../enum/enum';

export class ExportRepository extends BaseRepository<IExport> {
  constructor() {
    super(ExportModel);
  }

  async updateStatus(
    exportId: string,
    status: ExportStatus,
    extra?: { filePath?: string; error?: string },
  ): Promise<IExport | null> {
    return this.model
      .findByIdAndUpdate(exportId, { status, ...extra }, { new: true })
      .exec();
  }
}
