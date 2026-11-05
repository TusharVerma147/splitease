import { Channel, ConsumeMessage } from 'amqplib';
import { createConsumerChannel } from '../rabbitmq/rabbitmq.provider';
import { redisService } from '../redis/redis.service';
import { QueueName } from '../../enum/enum';
import { QUEUE_MAX_RETRIES, QUEUE_RETRY_DELAY_MS } from '../../common/constant';
import { sleep } from '../../common/utils';
import { logger } from '../../logger/logger';
import type { QueueMessage } from '../rabbitmq/rabbitmq.publisher';

export interface ConsumerHandle {
  /** Stops taking new messages and resolves once the in-flight ones are finished. */
  stop(): Promise<void>;
}

export interface ConsumerOptions {
  name: string;
  queue: QueueName;
  handler: (event: QueueMessage) => Promise<void>;
  prefetch?: number;
  /** Skip dedupe + retries (used by the dead-letter consumer). */
  plain?: boolean;
}

function retryCount(msg: ConsumeMessage): number {
  const value: unknown = msg.properties.headers?.['x-retry-count'];
  return typeof value === 'number' ? value : 0;
}

/**
 * Shared consumer plumbing:
 *  - idempotent: a messageId that was already processed successfully is acked and skipped
 *  - retried: a failing message is re-queued up to QUEUE_MAX_RETRIES times with a growing delay
 *  - dead-lettered: after that it is rejected, and RabbitMQ routes it to the dead-letter queue
 *  - graceful stop: cancel the subscription, wait for the message being handled, close the channel
 */
export async function startQueueConsumer(options: ConsumerOptions): Promise<ConsumerHandle> {
  const { name, queue, handler } = options;
  const channel: Channel = await createConsumerChannel();
  await channel.prefetch(options.prefetch ?? 1);

  const inFlight = new Set<Promise<void>>();

  const safely = (action: () => void): void => {
    try {
      action();
    } catch (err) {
      logger.warn('Could not ack/nack (channel closed?)', { consumer: name, err });
    }
  };

  const handle = async (msg: ConsumeMessage): Promise<void> => {
    let event: QueueMessage;
    try {
      event = JSON.parse(msg.content.toString()) as QueueMessage;
    } catch {
      if (options.plain) {
        logger.error('Unparseable dead-lettered message', { consumer: name, content: msg.content.toString() });
        safely(() => channel.ack(msg));
      } else {
        logger.error('Unparseable message, dead-lettering', { consumer: name });
        safely(() => channel.nack(msg, false, false));
      }
      return;
    }

    try {
      if (!options.plain && (await redisService.isMessageProcessed(name, event.messageId))) {
        logger.debug('Duplicate message skipped', { consumer: name, messageId: event.messageId });
        safely(() => channel.ack(msg));
        return;
      }

      await handler(event);

      if (!options.plain) await redisService.markMessageProcessed(name, event.messageId);
      safely(() => channel.ack(msg));
    } catch (err) {
      const attempt = retryCount(msg);
      logger.error('Consumer failed', { consumer: name, messageId: event.messageId, attempt, err });

      if (options.plain || attempt >= QUEUE_MAX_RETRIES) {
        safely(() => channel.nack(msg, false, false)); // -> dead-letter queue
        return;
      }

      await sleep(QUEUE_RETRY_DELAY_MS * (attempt + 1));
      safely(() => {
        channel.sendToQueue(queue, msg.content, {
          persistent: true,
          messageId: msg.properties.messageId as string | undefined,
          contentType: 'application/json',
          headers: { ...msg.properties.headers, 'x-retry-count': attempt + 1 },
        });
        channel.ack(msg);
      });
    }
  };

  const { consumerTag } = await channel.consume(queue, (msg) => {
    if (!msg) return;
    const task = handle(msg).finally(() => inFlight.delete(task));
    inFlight.add(task);
  });

  logger.info('Consumer started', { consumer: name, queue });

  return {
    async stop(): Promise<void> {
      try {
        await channel.cancel(consumerTag);
      } catch (err) {
        logger.warn('Error cancelling consumer', { consumer: name, err });
      }
      await Promise.allSettled([...inFlight]);
      try {
        await channel.close();
      } catch (err) {
        logger.warn('Error closing consumer channel', { consumer: name, err });
      }
      logger.info('Consumer stopped', { consumer: name });
    },
  };
}
