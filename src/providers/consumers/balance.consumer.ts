import { QueueName } from '../../enum/enum';
import { balanceService } from '../../modules/v1/balance/balance.service';
import { logger } from '../../logger/logger';
import { ConsumerHandle, startQueueConsumer } from './base.consumer';

/** Recalculates a group's balances and caches them in Redis (balances:<groupId>). */
export function startBalanceConsumer(): Promise<ConsumerHandle> {
  return startQueueConsumer({
    name: 'balance',
    queue: QueueName.BALANCE_RECALCULATE,
    handler: async (event) => {
      const groupId = event.payload['groupId'];
      if (typeof groupId !== 'string') throw new Error('balance event without groupId');

      await balanceService.refreshGroupBalances(groupId);
      logger.debug('Balance recalculated', { groupId, eventType: event.eventType });
    },
  });
}
