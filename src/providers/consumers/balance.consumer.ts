import { Channel, ConsumeMessage } from 'amqplib';
import { getRabbitChannel } from '../rabbitmq/rabbitmq.provider';
import { QueueName } from '../../enum/enum';
import { balanceService } from '../../modules/v1/balance/balance.service';
import { redisService } from '../redis/redis.service';
import { logger } from '../../logger/logger';

interface BalanceEvent {
  payload: { groupId: string };
  messageId: string;
}

export async function startBalanceConsumer(): Promise<void> {
  const channel: Channel = getRabbitChannel();
  await channel.prefetch(1);

  channel.consume(QueueName.BALANCE_RECALCULATE, (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const processMsg = async () => {
      try {
        const event = JSON.parse(msg.content.toString()) as BalanceEvent;
        const { groupId } = event.payload;

        logger.debug('Recalculating balances', { groupId, messageId: event.messageId });

        const balances = await balanceService.calculateGroupBalances(groupId);
        await redisService.setGroupBalances(groupId, JSON.stringify(balances));
        await redisService.clearBalanceStale(groupId);

        channel.ack(msg);
        logger.debug('Balance recalculated', { groupId });
      } catch (err) {
        logger.error('Balance consumer error', { err });
        channel.nack(msg, false, false);
      }
    };

    void processMsg();
  });

  logger.info('Balance consumer started');
}
