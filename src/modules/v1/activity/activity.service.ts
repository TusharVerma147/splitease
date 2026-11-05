import { ActivityRepository } from '../../../repositories/activity.repository';
import { parsePagination } from '../../../common/utils';
import { paginated } from '../../../common/responses';

const activityRepo = new ActivityRepository();

export class ActivityService {
  async getMyActivity(userId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = parsePagination(query);
    const { items, total } = await activityRepo.listForUser(userId, skip, limit);
    return paginated(items, total, page, limit);
  }
}

export const activityService = new ActivityService();
