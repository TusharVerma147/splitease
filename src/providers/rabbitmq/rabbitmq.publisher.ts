import { randomUUID } from 'crypto';
import { getPublishChannel } from './rabbitmq.provider';
import { QueueName, EventType } from '../../enum/enum';
import { logger } from '../../logger/logger';

export interface QueueMessage {
  eventType: EventType;
  payload: Record<string, unknown>;
  timestamp: string;
  messageId: string;
}

export function buildMessage(eventType: EventType, payload: Record<string, unknown>): QueueMessage {
  return {
    eventType,
    payload,
    timestamp: new Date().toISOString(),
    messageId: randomUUID(),
  };
}

/**
 * Publishes a persistent message and waits for the broker's confirm.
 * Never throws: a failed publish must not fail the HTTP request that already
 * committed its data, so it is logged for follow-up instead.
 */
export async function publishToQueue(queue: QueueName, message: QueueMessage): Promise<void> {
  try {
    const channel = getPublishChannel();
    await new Promise<void>((resolve, reject) => {
      channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, messageId: message.messageId, contentType: 'application/json' },
        (err) => (err ? reject(err instanceof Error ? err : new Error('publish nacked')) : resolve()),
      );
    });
  } catch (err) {
    logger.error('Failed to publish message', { queue, eventType: message.eventType, err });
  }
}

/** Publish the same event to several queues, each copy with its own messageId. */
export async function publishEvent(
  queues: QueueName[],
  eventType: EventType,
  payload: Record<string, unknown>,
): Promise<void> {
  await Promise.all(queues.map((queue) => publishToQueue(queue, buildMessage(eventType, payload))));
}
