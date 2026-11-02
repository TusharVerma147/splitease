import amqplib from 'amqplib';
import { config } from '../../config/configuration';
import { logger } from '../../logger/logger';
import { QueueName } from '../../enum/enum';

let connection: amqplib.ChannelModel | null = null;
let channel: amqplib.Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
  connection = await amqplib.connect(config.RABBITMQ_URL);
  channel = await connection.createChannel();

  await channel.assertExchange('dlx', 'direct', { durable: true });
  await channel.assertQueue(QueueName.DEAD_LETTER, { durable: true });
  await channel.bindQueue(QueueName.DEAD_LETTER, 'dlx', QueueName.DEAD_LETTER);

  const queueOptions = {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx',
      'x-dead-letter-routing-key': QueueName.DEAD_LETTER,
    },
  };

  await channel.assertQueue(QueueName.BALANCE_RECALCULATE, queueOptions);
  await channel.assertQueue(QueueName.NOTIFICATION, queueOptions);
  await channel.assertQueue(QueueName.EXPORT, queueOptions);

  connection.on('error', (err) => logger.error('RabbitMQ connection error', { err }));
  connection.on('close', () => logger.warn('RabbitMQ connection closed'));

  logger.info('RabbitMQ connected');
}

export function getRabbitChannel(): amqplib.Channel {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  return channel;
}

export async function closeRabbitMQ(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
  logger.info('RabbitMQ connection closed');
}

export async function healthCheck(): Promise<boolean> {
  return channel !== null;
}
