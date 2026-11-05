import { Request, Response } from 'express';
import { activityService } from './activity.service';
import { sendSuccess } from '../../../common/responses';
import { ListActivityQueryDto } from './dto/activity.dto';

export class ActivityController {
  getMyActivity = async (req: Request, res: Response): Promise<void> => {
    const result = await activityService.getMyActivity(
      req.user?.userId ?? '',
      req.query as unknown as ListActivityQueryDto,
    );
    sendSuccess(res, result, 'Activity fetched');
  };
}

export const activityController = new ActivityController();
