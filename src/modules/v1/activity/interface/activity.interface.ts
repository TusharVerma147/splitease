import { ActivityType } from '../../../../enum/enum';

export interface ActivityView {
  id: string;
  groupId: string;
  type: ActivityType;
  payload: Record<string, unknown>;
  createdAt: Date;
}
