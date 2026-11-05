import path from 'path';
import fs from 'fs';
import { ExportRepository } from '../../../repositories/export.repository';
import { GroupRepository } from '../../../repositories/group.repository';
import { ExpenseRepository } from '../../../repositories/expense.repository';
import { UserRepository } from '../../../repositories/user.repository';
import { Errors } from '../../../common/errors';
import { config } from '../../../config/configuration';
import { ExportStatus, QueueName, EventType } from '../../../enum/enum';
import { redisService } from '../../../providers/redis/redis.service';
import { publishEvent } from '../../../providers/rabbitmq/rabbitmq.publisher';
import { workerThreadService } from '../../../providers/workerThread/worker-thread.service';
import type { CsvInput, CsvOutput } from '../../../providers/workerThread/exportCsv.worker';
import { logger } from '../../../logger/logger';
import { IExport } from '../../../schemas/export.schema';
import { ExportRequestResult, ExportStatusView } from './interface/export.interface';

const exportRepo = new ExportRepository();
const groupRepo = new GroupRepository();
const expenseRepo = new ExpenseRepository();
const userRepo = new UserRepository();

export class ExportService {
  async requestExport(groupId: string, requestedBy: string): Promise<ExportRequestResult> {
    const exportDoc = await exportRepo.createQueued(groupId, requestedBy);
    const exportId = String(exportDoc._id);

    await redisService.setExportProgress(exportId, 0);
    await publishEvent([QueueName.EXPORT], EventType.EXPORT_REQUESTED, { exportId, groupId, requestedBy });

    return { exportId, status: exportDoc.status };
  }

  /** Visible to members of the group the export belongs to. */
  private async getAccessibleExport(exportId: string, userId: string): Promise<IExport> {
    const exportDoc = await exportRepo.findById(exportId);
    if (!exportDoc) throw Errors.notFound('Export');
    if (!(await groupRepo.isMember(String(exportDoc.groupId), userId))) throw Errors.notFound('Export');
    return exportDoc;
  }

  async getExportStatus(exportId: string, userId: string): Promise<ExportStatusView> {
    const exportDoc = await this.getAccessibleExport(exportId, userId);
    const progress = exportDoc.status === ExportStatus.DONE ? 100 : await redisService.getExportProgress(exportId);
    return { status: exportDoc.status, progress, ...(exportDoc.error && { error: exportDoc.error }) };
  }

  /** Returns the CSV path; 404 until the export is DONE. */
  async downloadExport(exportId: string, userId: string): Promise<string> {
    const exportDoc = await this.getAccessibleExport(exportId, userId);
    if (exportDoc.status !== ExportStatus.DONE || !exportDoc.filePath) throw Errors.notFound('Export file');
    return exportDoc.filePath;
  }

  /** Runs inside the export consumer: gathers data, builds the CSV on a worker thread, saves it. */
  async processExport(exportId: string, groupId: string): Promise<void> {
    const exportDoc = await exportRepo.findById(exportId);
    if (!exportDoc || exportDoc.status === ExportStatus.DONE) return;

    await exportRepo.updateStatus(exportId, ExportStatus.PROCESSING);
    await redisService.setExportProgress(exportId, 10);

    try {
      const group = await groupRepo.findById(groupId);
      if (!group) throw new Error('Group not found');

      const expenses = await expenseRepo.findAllByGroup(groupId);
      await redisService.setExportProgress(exportId, 40);

      // Former members still appear in old expenses, so they keep a column too.
      const memberIds = group.members.map((m) => String(m.userId));
      const formerIds = new Set<string>();
      for (const e of expenses) {
        for (const id of [String(e.paidBy), ...e.splits.map((s) => String(s.userId))]) {
          if (!memberIds.includes(id)) formerIds.add(id);
        }
      }
      const userIds = new Set<string>([...memberIds, ...formerIds]);
      const users = await userRepo.findByIds([...userIds]);
      const names = new Map(users.map((u) => [String(u._id), u.name]));
      await redisService.setExportProgress(exportId, 55);

      const input: CsvInput = {
        members: [...memberIds, ...formerIds].map((userId) => ({
          userId,
          name: names.get(userId) ?? 'Unknown',
        })),
        expenses: expenses.map((e) => ({
          date: e.expenseDate.toISOString().slice(0, 10),
          description: e.description,
          paidBy: names.get(String(e.paidBy)) ?? 'Unknown',
          amount: e.amount,
          splitType: e.splitType,
          splits: e.splits.map((s) => ({ userId: String(s.userId), share: s.share })),
        })),
      };

      // CPU-bound work happens off the main thread; input and output are plain data.
      const { csv } = await workerThreadService.runTask<CsvInput, CsvOutput>('exportCsv', input);
      await redisService.setExportProgress(exportId, 80);

      await fs.promises.mkdir(config.EXPORT_DIR, { recursive: true });
      const filePath = path.join(config.EXPORT_DIR, `export_${exportId}.csv`);
      const tmpPath = `${filePath}.tmp`;
      await fs.promises.writeFile(tmpPath, csv, 'utf-8');
      await fs.promises.rename(tmpPath, filePath);

      await redisService.setExportProgress(exportId, 100);
      await exportRepo.updateStatus(exportId, ExportStatus.DONE, { filePath });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Export failed', { exportId, err });
      await exportRepo.updateStatus(exportId, ExportStatus.FAILED, { error: message });
    }
  }
}

export const exportService = new ExportService();
