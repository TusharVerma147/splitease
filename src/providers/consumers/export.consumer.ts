import { Channel, ConsumeMessage } from 'amqplib';
import { getRabbitChannel } from '../rabbitmq/rabbitmq.provider';
import { QueueName } from '../../enum/enum';
import { exportService } from '../../modules/v1/export/export.service';
import { logger } from '../../logger/logger';

interface ExportEvent {
  payload: { exportId: string; groupId: string };
  messageId: string;
}

export async function startExportConsumer(): Promise<void> {
  const channel: Channel = getRabbitChannel();
  await channel.prefetch(1);

  channel.consume(QueueName.EXPORT, (msg: ConsumeMessage | null) => {
    if (!msg) return;

    const processMsg = async () => {
      try {
        const event = JSON.parse(msg.content.toString()) as ExportEvent;
        const { exportId, groupId } = event.payload;

        logger.debug('Processing export', { exportId, groupId });
        await exportService.processExport(exportId, groupId);
        channel.ack(msg);
        logger.debug('Export done', { exportId });
      } catch (err) {
        logger.error('Export consumer error', { err });
        channel.nack(msg, false, false);
      }
    };

    void processMsg();
  });

  logger.info('Export consumer started');
}
