import { QueueName } from '../../enum/enum';
import { logger } from '../../logger/logger';
import { ConsumerHandle, startQueueConsumer } from './base.consumer';

/** Parks failed messages: logs them loudly so they can be inspected and replayed. */
export function startDeadLetterConsumer(): Promise<ConsumerHandle> {
  return startQueueConsumer({
    name: 'dead-letter',
    queue: QueueName.DEAD_LETTER,
    plain: true,
    handler: (event) => {
      logger.error('Dead-lettered message', {
        eventType: event.eventType,
        messageId: event.messageId,
        payload: event.payload,
      });
      return Promise.resolve();
    },
  });
}
