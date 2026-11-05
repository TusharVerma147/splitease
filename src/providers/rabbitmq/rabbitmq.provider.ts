import amqplib from 'amqplib';
import { config } from '../../config/configuration';
import { logger } from '../../logger/logger';
import { QueueName } from '../../enum/enum';
import { sleep } from '../../common/utils';

let connection: amqplib.ChannelModel | null = null;
let publishChannel: amqplib.ConfirmChannel | null = null;
let connected = false;
let closing = false;
let onUnexpectedClose: (() => void) | undefined;

const QUEUE_OPTIONS: amqplib.Options.AssertQueue = {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': 'dlx',
    'x-dead-letter-routing-key': QueueName.DEAD_LETTER,
  },
};

async function openConnection(): Promise<void> {
  const conn = await amqplib.connect(config.RABBITMQ_URL);
  const channel = await conn.createConfirmChannel();

  await channel.assertExchange('dlx', 'direct', { durable: true });
  await channel.assertQueue(QueueName.DEAD_LETTER, { durable: true });
  await channel.bindQueue(QueueName.DEAD_LETTER, 'dlx', QueueName.DEAD_LETTER);

  await channel.assertQueue(QueueName.BALANCE_RECALCULATE, QUEUE_OPTIONS);
  await channel.assertQueue(QueueName.NOTIFICATION, QUEUE_OPTIONS);
  await channel.assertQueue(QueueName.EXPORT, QUEUE_OPTIONS);

  conn.on('error', (err) => logger.error('RabbitMQ connection error', { err }));
  conn.on('close', () => {
    connected = false;
    if (closing) return;
    logger.error('RabbitMQ connection lost');
    if (onUnexpectedClose) onUnexpectedClose();
    else void reconnectLoop();
  });

  connection = conn;
  publishChannel = channel;
  connected = true;
}

async function reconnectLoop(): Promise<void> {
  while (!closing && !connected) {
    await sleep(5000);
    try {
      await openConnection();
      logger.info('RabbitMQ reconnected');
    } catch (err) {
      logger.warn('RabbitMQ reconnect failed, retrying', { err });
    }
  }
}

/**
 * Connects and declares the topology (queues + dead-letter exchange).
 * By default the API reconnects in the background; consumers pass `onClose` to exit
 * instead so the container restarts and re-subscribes.
 */
export async function connectRabbitMQ(options?: { onClose?: () => void }): Promise<void> {
  onUnexpectedClose = options?.onClose;
  closing = false;
  await openConnection();
  logger.info('RabbitMQ connected');
}

/** Channel used by publishers (publisher confirms enabled). */
export function getPublishChannel(): amqplib.ConfirmChannel {
  if (!publishChannel || !connected) throw new Error('RabbitMQ channel not initialized');
  return publishChannel;
}

/** A dedicated channel per consumer, so each has its own prefetch + lifecycle. */
export async function createConsumerChannel(): Promise<amqplib.Channel> {
  if (!connection || !connected) throw new Error('RabbitMQ is not connected');
  return connection.createChannel();
}

export async function closeRabbitMQ(): Promise<void> {
  closing = true;
  try {
    if (publishChannel) await publishChannel.close();
  } catch (err) {
    logger.warn('Error closing RabbitMQ publish channel', { err });
  }
  try {
    if (connection) await connection.close();
  } catch (err) {
    logger.warn('Error closing RabbitMQ connection', { err });
  }
  publishChannel = null;
  connection = null;
  connected = false;
  logger.info('RabbitMQ connection closed');
}

export async function healthCheck(): Promise<boolean> {
  return connected && publishChannel !== null;
}
