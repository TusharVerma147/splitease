import { Request, Response } from 'express';
import fs from 'fs';
import { exportService } from './export.service';
import { sendSuccess, sendError } from '../../../common/responses';
import { AppError } from '../../../common/errors';

export class ExportController {
  async requestExport(req: Request, res: Response): Promise<void> {
    try {
      const exportDoc = await exportService.requestExport(req.params['groupId']!, req.user!.userId);
      sendSuccess(res, { exportId: String(exportDoc._id), status: exportDoc.status }, 'Export queued', 202);
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async getExportStatus(req: Request, res: Response): Promise<void> {
    try {
      const exportDoc = await exportService.getExportStatus(req.params['exportId']!, req.user!.userId);
      sendSuccess(res, { status: exportDoc.status, progress: exportDoc.progress }, 'Export status');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async downloadExport(req: Request, res: Response): Promise<void> {
    try {
      const filePath = await exportService.downloadExport(req.params['exportId']!, req.user!.userId);
      if (!fs.existsSync(filePath)) {
        sendError(res, 404, 'NOT_FOUND', 'Export file not found', req.requestId);
        return;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${req.params['exportId']}.csv"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }
}

export const exportController = new ExportController();
