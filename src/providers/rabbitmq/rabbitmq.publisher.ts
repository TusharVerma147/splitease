import { getRabbitChannel } from './rabbitmq.provider';
import { QueueName, EventType } from '../../enum/enum';
import { logger } from '../../logger/logger';

interface QueueMessage {
  eventType: EventType;
  payload: Record<string, unknown>;
  timestamp: string;
  messageId: string;
}

export function publishToQueue(queue: QueueName, message: QueueMessage): void {
  try {
    const channel = getRabbitChannel();
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      messageId: message.messageId,
    });
  } catch (err) {
    logger.error('Failed to publish message', { queue, err });
  }
}

export function buildMessage(
  eventType: EventType,
  payload: Record<string, unknown>,
): QueueMessage {
  return {
    eventType,
    payload,
    timestamp: new Date().toISOString(),
    messageId: `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
}
