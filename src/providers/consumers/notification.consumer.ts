import { QueueName, EventType, ActivityType } from '../../enum/enum';
import { ActivityRepository } from '../../repositories/activity.repository';
import { GroupRepository } from '../../repositories/group.repository';
import { UserRepository } from '../../repositories/user.repository';
import { sendEmail } from '../email/email.provider';
import { escapeHtml, formatInr } from '../../common/utils';
import { IGroup } from '../../schemas/group.schema';
import type { QueueMessage } from '../rabbitmq/rabbitmq.publisher';
import { ConsumerHandle, startQueueConsumer } from './base.consumer';

const activityRepo = new ActivityRepository();
const groupRepo = new GroupRepository();
const userRepo = new UserRepository();

const eventToActivityType: Partial<Record<EventType, ActivityType>> = {
  [EventType.EXPENSE_CREATED]: ActivityType.EXPENSE_ADDED,
  [EventType.EXPENSE_UPDATED]: ActivityType.EXPENSE_UPDATED,
  [EventType.EXPENSE_DELETED]: ActivityType.EXPENSE_DELETED,
  [EventType.SETTLEMENT_CREATED]: ActivityType.SETTLEMENT_ADDED,
  [EventType.MEMBER_ADDED]: ActivityType.MEMBER_ADDED,
};

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

function describe(event: QueueMessage, group: IGroup, name: (id: string) => string): string {
  const p = event.payload;
  const who = name(str(p['actorId'] || p['addedBy']));
  switch (event.eventType) {
    case EventType.EXPENSE_CREATED:
      return `${who} added "${str(p['description'])}" (${formatInr(num(p['amount']))}) in ${group.name}`;
    case EventType.EXPENSE_UPDATED:
      return `${who} edited "${str(p['description'])}" (${formatInr(num(p['amount']))}) in ${group.name}`;
    case EventType.EXPENSE_DELETED:
      return `${who} deleted "${str(p['description'])}" (${formatInr(num(p['amount']))}) in ${group.name}`;
    case EventType.SETTLEMENT_CREATED:
      return `${name(str(p['fromUserId']))} paid ${name(str(p['toUserId']))} ${formatInr(num(p['amount']))} in ${group.name}`;
    case EventType.MEMBER_ADDED:
      return `${who} added ${name(str(p['userId']))} to ${group.name}`;
    default:
      return `New activity in ${group.name}`;
  }
}

/**
 * Turns domain events into activity documents (the in-app feed) and emails to Mailpit.
 * Idempotent: the activity is keyed on the message id, and emails are sent only after it exists.
 */
export function startNotificationConsumer(): Promise<ConsumerHandle> {
  return startQueueConsumer({
    name: 'notification',
    queue: QueueName.NOTIFICATION,
    handler: async (event) => {
      const activityType = eventToActivityType[event.eventType];
      const groupId = str(event.payload['groupId']);
      if (!activityType || !groupId) return;

      const group = await groupRepo.findById(groupId);
      if (!group) return;

      const memberIds = group.members.map((m) => String(m.userId));
      const involved = [
        ...memberIds,
        ...['actorId', 'addedBy', 'fromUserId', 'toUserId', 'userId'].map((k) => str(event.payload[k])).filter(Boolean),
      ];
      const users = await userRepo.findByIds([...new Set(involved)]);
      const byId = new Map(users.map((u) => [String(u._id), u]));
      const name = (id: string): string => byId.get(id)?.name ?? 'Someone';

      await activityRepo.createIfAbsent({
        messageId: event.messageId,
        userIds: memberIds,
        groupId,
        type: activityType,
        payload: event.payload,
      });

      const text = describe(event, group, name);
      const actorId = str(event.payload['actorId'] || event.payload['addedBy']);
      const subject = `SplitEase: ${activityType.replace(/_/g, ' ').toLowerCase()} in ${group.name}`;

      await Promise.all(
        memberIds
          .filter((id) => id !== actorId)
          .map((id) => byId.get(id))
          .filter((u): u is NonNullable<typeof u> => !!u)
          .map((u) => sendEmail(u.email, subject, `<p>Hi ${escapeHtml(u.name)},</p><p>${escapeHtml(text)}.</p>`)),
      );
    },
  });
}
