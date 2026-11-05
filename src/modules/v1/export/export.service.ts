import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { ExportRepository } from '../../../repositories/export.repository';
import { GroupRepository } from '../../../repositories/group.repository';
import { ExpenseModel } from '../../../schemas/expense.schema';
import { Errors } from '../../../common/errors';
import { ExportStatus, QueueName, EventType } from '../../../enum/enum';
import { redisService } from '../../../providers/redis/redis.service';
import { publishToQueue, buildMessage } from '../../../providers/rabbitmq/rabbitmq.publisher';
import { IExport } from '../../../schemas/export.schema';

const exportRepo = new ExportRepository();
const groupRepo = new GroupRepository();

export const EXPORT_DIR = path.join(process.cwd(), 'exports');

export class ExportService {
  async requestExport(groupId: string, requestedBy: string): Promise<IExport> {
    const group = await groupRepo.findById(groupId);
    if (!group) throw Errors.notFound('Group');

    const exportDoc = await exportRepo.create({
      groupId: new mongoose.Types.ObjectId(groupId) as unknown as mongoose.Types.ObjectId,
      requestedBy: new mongoose.Types.ObjectId(requestedBy) as unknown as mongoose.Types.ObjectId,
      status: ExportStatus.QUEUED,
    });

    await redisService.setExportProgress(String(exportDoc._id), 0);

    publishToQueue(
      QueueName.EXPORT,
      buildMessage(EventType.EXPENSE_CREATED, {
        exportId: String(exportDoc._id),
        groupId,
      }),
    );

    return exportDoc;
  }

  async getExportStatus(exportId: string, requestedBy: string): Promise<IExport & { progress: number }> {
    const exportDoc = await exportRepo.findById(exportId);
    if (!exportDoc || String(exportDoc.requestedBy) !== requestedBy) throw Errors.notFound('Export');

    const progress = await redisService.getExportProgress(exportId);
    return Object.assign(exportDoc.toObject(), { progress }) as IExport & { progress: number };
  }

  async downloadExport(exportId: string, requestedBy: string): Promise<string> {
    const exportDoc = await exportRepo.findById(exportId);
    if (!exportDoc || String(exportDoc.requestedBy) !== requestedBy) throw Errors.notFound('Export');
    if (exportDoc.status !== ExportStatus.DONE || !exportDoc.filePath) {
      throw Errors.notFound('Export file not ready');
    }
    return exportDoc.filePath;
  }

  async processExport(exportId: string, groupId: string): Promise<void> {
    await exportRepo.updateStatus(exportId, ExportStatus.PROCESSING);
    await redisService.setExportProgress(exportId, 10);

    try {
      const group = await groupRepo.findById(groupId);
      if (!group) throw new Error('Group not found');

      await redisService.setExportProgress(exportId, 30);

      const expenses = await ExpenseModel.find({
        groupId: new mongoose.Types.ObjectId(groupId),
        isDeleted: false,
      })
        .sort({ expenseDate: 1 })
        .lean();

      await redisService.setExportProgress(exportId, 50);

      const User = mongoose.model('User');
      const memberIds = group.members.map((m) => m.userId);
      const users = (await User.find({ _id: { $in: memberIds } })
        .select('name')
        .lean()) as unknown as Array<{ _id: mongoose.Types.ObjectId; name: string }>;
      const nameMap = new Map(users.map((u) => [String(u._id), u.name]));

      const members = group.members.map((m) => ({
        userId: String(m.userId),
        name: nameMap.get(String(m.userId)) ?? 'Unknown',
      }));

      await redisService.setExportProgress(exportId, 70);

      const memberNames = members.map((m) => m.name);
      const header = ['date', 'description', 'paidBy', 'amount(paise)', 'splitType', ...memberNames].join(',');

      const rows = expenses.map((exp) => {
        const paidByName = nameMap.get(String(exp.paidBy)) ?? String(exp.paidBy);
        const memberShares = members.map((m) => {
          const split = exp.splits.find((s) => String(s.userId) === m.userId);
          return split ? split.share : 0;
        });
        return [
          new Date(exp.expenseDate).toISOString().split('T')[0],
          `"${exp.description}"`,
          paidByName,
          exp.amount,
          exp.splitType,
          ...memberShares,
        ].join(',');
      });

      const csv = [header, ...rows].join('\n');
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
      const filePath = path.join(EXPORT_DIR, `export_${exportId}.csv`);
      fs.writeFileSync(filePath, csv, 'utf-8');

      await redisService.setExportProgress(exportId, 100);
      await exportRepo.updateStatus(exportId, ExportStatus.DONE, { filePath });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await exportRepo.updateStatus(exportId, ExportStatus.FAILED, { error: message });
      await redisService.setExportProgress(exportId, 0);
    }
  }
}

export const exportService = new ExportService();
