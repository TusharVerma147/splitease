import { ActivityRepository } from '../../../repositories/activity.repository';
import { parsePagination } from '../../../common/utils';
import { paginated, PaginatedData } from '../../../common/responses';
import { ListActivityQueryDto } from './dto/activity.dto';
import { ActivityView } from './interface/activity.interface';

const activityRepo = new ActivityRepository();

export class ActivityService {
  async getMyActivity(userId: string, query: ListActivityQueryDto): Promise<PaginatedData<ActivityView>> {
    const { page, limit, skip } = parsePagination(query);
    const { items, total } = await activityRepo.listForUser(userId, skip, limit, query.order);
    const views = items.map((a) => ({
      id: String(a._id),
      groupId: String(a.groupId),
      type: a.type,
      payload: a.payload,
      createdAt: a.createdAt,
    }));
    return paginated(views, total, page, limit);
  }
}

export const activityService = new ActivityService();
