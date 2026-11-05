import { Request, Response } from 'express';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { exportService } from './export.service';
import { sendSuccess } from '../../../common/responses';
import { Errors } from '../../../common/errors';
import { logger } from '../../../logger/logger';

export class ExportController {
  requestExport = async (req: Request, res: Response): Promise<void> => {
    const result = await exportService.requestExport(req.params['groupId'] ?? '', req.user?.userId ?? '');
    sendSuccess(res, result, 'Export queued', 202);
  };

  getExportStatus = async (req: Request, res: Response): Promise<void> => {
    const status = await exportService.getExportStatus(req.params['exportId'] ?? '', req.user?.userId ?? '');
    sendSuccess(res, status, 'Export status');
  };

  downloadExport = async (req: Request, res: Response): Promise<void> => {
    const exportId = req.params['exportId'] ?? '';
    const filePath = await exportService.downloadExport(exportId, req.user?.userId ?? '');
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      throw Errors.notFound('Export file');
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="export_${exportId}.csv"`);
    try {
      await pipeline(fs.createReadStream(filePath), res);
    } catch (err) {
      logger.error('Export download interrupted', { exportId, err });
      res.destroy();
    }
  };
}

export const exportController = new ExportController();
