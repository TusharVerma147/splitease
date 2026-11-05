import { Request, Response } from 'express';
import { activityService } from './activity.service';
import { sendSuccess, sendError } from '../../../common/responses';

export class ActivityController {
  async getMyActivity(req: Request, res: Response): Promise<void> {
    try {
      const result = await activityService.getMyActivity(req.user!.userId, req.query as Record<string, unknown>);
      sendSuccess(res, result, 'Activity fetched');
    } catch (err) {
      sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }
}

export const activityController = new ActivityController();
