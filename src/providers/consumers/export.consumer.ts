import { QueueName } from '../../enum/enum';
import { exportService } from '../../modules/v1/export/export.service';
import { ConsumerHandle, startQueueConsumer } from './base.consumer';

/** Builds the CSV statement for an export request (CSV generation runs on a worker thread). */
export function startExportConsumer(): Promise<ConsumerHandle> {
  return startQueueConsumer({
    name: 'export',
    queue: QueueName.EXPORT,
    handler: async (event) => {
      const { exportId, groupId } = event.payload;
      if (typeof exportId !== 'string' || typeof groupId !== 'string') {
        throw new Error('export event without exportId/groupId');
      }
      await exportService.processExport(exportId, groupId);
    },
  });
}
