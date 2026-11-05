import { Channel, ConsumeMessage } from 'amqplib';
import { getRabbitChannel } from '../rabbitmq/rabbitmq.provider';
import { QueueName, EventType, ActivityType } from '../../enum/enum';
import { ActivityRepository } from '../../repositories/activity.repository';
import { GroupRepository } from '../../repositories/group.repository';
import { UserModel } from '../../schemas/user.schema';
import { sendEmail } from '../email/email.provider';
import { logger } from '../../logger/logger';

const activityRepo = new ActivityRepository();
const groupRepo = new GroupRepository();

interface NotificationEvent {
  eventType: EventType;
  payload: Record<string, string>;
  messageId: string;
}

const eventToActivityType: Partial<Record<EventType, ActivityType>> = {
  [EventType.EXPENSE_CREATED]: ActivityType.EXPENSE_ADDED,
  [EventType.EXPENSE_UPDATED]: ActivityType.EXPENSE_UPDATED,
  [EventType.EXPENSE_DELETED]: ActivityType.EXPENSE_DELETED,
  [EventType.SETTLEMENT_CREATED]: ActivityType.SETTLEMENT_ADDED,
  [EventType.MEMBER_ADDED]: ActivityType.MEMBER_ADDED,
};

export async function startNotificationConsumer(): Promise<void> {
  const channel: Channel = getRabbitChannel();
  await channel.prefetch(1);

  channel.consume(QueueName.NOTIFICATION, (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const processMsg = async () => {
      try {
        const event = JSON.parse(msg.content.toString()) as NotificationEvent;
        const activityType = eventToActivityType[event.eventType];

        if (activityType && event.payload['groupId']) {
          const group = await groupRepo.findById(event.payload['groupId']);
          if (group) {
            const userIds = group.members.map((m) => String(m.userId));
            await activityRepo.createActivity({
              userIds,
              groupId: event.payload['groupId'],
              type: activityType,
              payload: event.payload,
            });

            const users = (await UserModel.find({ _id: { $in: userIds } })
              .select('email name')
              .lean()) as Array<{ email: string; name: string }>;

            for (const user of users) {
              void sendEmail(
                user.email,
                `SplitEase: ${activityType.replace(/_/g, ' ')}`,
                `<p>Hi ${user.name}, a new activity occurred in group <b>${group.name}</b>.</p>`,
              );
            }
          }
        }

        channel.ack(msg);
      } catch (err) {
        logger.error('Notification consumer error', { err });
        channel.nack(msg, false, false);
      }
    };

    void processMsg();
  });

  logger.info('Notification consumer started');
}
