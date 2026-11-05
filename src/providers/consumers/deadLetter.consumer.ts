import { Channel, ConsumeMessage } from 'amqplib';
import { getRabbitChannel } from '../rabbitmq/rabbitmq.provider';
import { QueueName } from '../../enum/enum';
import { logger } from '../../logger/logger';

export async function startDeadLetterConsumer(): Promise<void> {
  const channel: Channel = getRabbitChannel();

  channel.consume(QueueName.DEAD_LETTER, (msg: ConsumeMessage | null) => {
    if (!msg) return;
    logger.error('Dead letter message received', {
      content: msg.content.toString(),
      fields: msg.fields,
    });
    channel.ack(msg);
  });

  logger.info('Dead letter consumer started');
}
