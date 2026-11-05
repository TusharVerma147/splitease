import { getRedisClient } from './redis.provider';
import {
  BALANCE_CACHE_SECONDS,
  EXPORT_PROGRESS_SECONDS,
  PROCESSED_MESSAGE_SECONDS,
  REDIS_KEYS,
  TOKEN_EXPIRY,
} from '../../common/constant';

export interface CachedBalances<T> {
  version: number;
  balances: T[];
}

/** Atomically replace the stored jti only if it still equals the presented one. */
const ROTATE_JTI_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  return 1
end
return 0
`;

export class RedisService {
  private get client() {
    return getRedisClient();
  }

  // ── sessions + refresh tokens ──────────────────────────────────────────

  async setSession(sessionId: string, userId: string): Promise<void> {
    await this.client.setex(REDIS_KEYS.session(sessionId), TOKEN_EXPIRY.SESSION_SECONDS, userId);
  }

  async getSession(sessionId: string): Promise<string | null> {
    return this.client.get(REDIS_KEYS.session(sessionId));
  }

  /** Ends a session: removes the session key and its current refresh jti. */
  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(REDIS_KEYS.session(sessionId), REDIS_KEYS.refreshJti(sessionId));
  }

  async setRefreshJti(sessionId: string, jti: string): Promise<void> {
    await this.client.setex(REDIS_KEYS.refreshJti(sessionId), TOKEN_EXPIRY.REFRESH_SECONDS, jti);
  }

  async getRefreshJti(sessionId: string): Promise<string | null> {
    return this.client.get(REDIS_KEYS.refreshJti(sessionId));
  }

  /** Returns true when `oldJti` was the current one and has been replaced by `newJti`. */
  async rotateRefreshJti(sessionId: string, oldJti: string, newJti: string): Promise<boolean> {
    const result = await this.client.eval(
      ROTATE_JTI_SCRIPT,
      1,
      REDIS_KEYS.refreshJti(sessionId),
      oldJti,
      newJti,
      String(TOKEN_EXPIRY.REFRESH_SECONDS),
    );
    return result === 1;
  }

  // ── login rate limit ───────────────────────────────────────────────────

  async incrementLoginAttempts(email: string, ip: string, windowMs: number): Promise<number> {
    const key = REDIS_KEYS.loginAttempts(email, ip);
    const count = await this.client.incr(key);
    if (count === 1 || (await this.client.pttl(key)) < 0) {
      await this.client.pexpire(key, windowMs);
    }
    return count;
  }

  // ── balance cache ──────────────────────────────────────────────────────

  async getBalanceVersion(groupId: string): Promise<number> {
    const val = await this.client.get(REDIS_KEYS.balanceVersion(groupId));
    return val ? parseInt(val, 10) : 0;
  }

  /** Marks cached balances stale; a recalculation job is expected to follow. */
  async bumpBalanceVersion(groupId: string): Promise<void> {
    await this.client.incr(REDIS_KEYS.balanceVersion(groupId));
  }

  async getGroupBalances<T>(groupId: string): Promise<CachedBalances<T> | null> {
    const raw = await this.client.get(REDIS_KEYS.groupBalances(groupId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedBalances<T>;
    } catch {
      return null;
    }
  }

  async setGroupBalances<T>(groupId: string, version: number, balances: T[]): Promise<void> {
    const value: CachedBalances<T> = { version, balances };
    await this.client.setex(REDIS_KEYS.groupBalances(groupId), BALANCE_CACHE_SECONDS, JSON.stringify(value));
  }

  // ── export progress ────────────────────────────────────────────────────

  async getExportProgress(exportId: string): Promise<number> {
    const val = await this.client.get(REDIS_KEYS.exportProgress(exportId));
    return val ? parseInt(val, 10) : 0;
  }

  async setExportProgress(exportId: string, progress: number): Promise<void> {
    await this.client.setex(REDIS_KEYS.exportProgress(exportId), EXPORT_PROGRESS_SECONDS, String(progress));
  }

  // ── consumer idempotency ───────────────────────────────────────────────

  async isMessageProcessed(consumer: string, messageId: string): Promise<boolean> {
    return (await this.client.exists(REDIS_KEYS.processedMessage(consumer, messageId))) === 1;
  }

  async markMessageProcessed(consumer: string, messageId: string): Promise<void> {
    await this.client.setex(REDIS_KEYS.processedMessage(consumer, messageId), PROCESSED_MESSAGE_SECONDS, '1');
  }

  // ── health ─────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}

export const redisService = new RedisService();
