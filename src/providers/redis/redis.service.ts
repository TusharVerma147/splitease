import { getRedisClient } from './redis.provider';
import { REDIS_KEYS, TOKEN_EXPIRY } from '../../common/constant';

export class RedisService {
  private get client() {
    return getRedisClient();
  }

  async setSession(sessionId: string, userId: string): Promise<void> {
    await this.client.setex(
      REDIS_KEYS.session(sessionId),
      TOKEN_EXPIRY.SESSION_SECONDS,
      userId,
    );
  }

  async getSession(sessionId: string): Promise<string | null> {
    return this.client.get(REDIS_KEYS.session(sessionId));
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(REDIS_KEYS.session(sessionId));
  }

  async storeRefreshJti(jti: string): Promise<void> {
    await this.client.setex(
      REDIS_KEYS.refreshToken(jti),
      TOKEN_EXPIRY.REFRESH_SECONDS,
      '1',
    );
  }

  async isRefreshJtiValid(jti: string): Promise<boolean> {
    const val = await this.client.get(REDIS_KEYS.refreshToken(jti));
    return val === '1';
  }

  async revokeRefreshJti(jti: string): Promise<void> {
    await this.client.del(REDIS_KEYS.refreshToken(jti));
  }

  async incrementLoginAttempts(email: string, ip: string, windowMs: number): Promise<number> {
    const key = REDIS_KEYS.loginAttempts(email, ip);
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.pexpire(key, windowMs);
    }
    return count;
  }

  async getGroupBalances(groupId: string): Promise<string | null> {
    return this.client.get(REDIS_KEYS.groupBalances(groupId));
  }

  async setGroupBalances(groupId: string, data: string): Promise<void> {
    await this.client.setex(REDIS_KEYS.groupBalances(groupId), 300, data);
  }

  async invalidateGroupBalances(groupId: string): Promise<void> {
    await this.client.del(REDIS_KEYS.groupBalances(groupId));
    await this.client.set(REDIS_KEYS.balanceStale(groupId), '1');
  }

  async isBalanceStale(groupId: string): Promise<boolean> {
    const val = await this.client.get(REDIS_KEYS.balanceStale(groupId));
    return val === '1';
  }

  async clearBalanceStale(groupId: string): Promise<void> {
    await this.client.del(REDIS_KEYS.balanceStale(groupId));
  }

  async getExportProgress(exportId: string): Promise<number> {
    const val = await this.client.get(REDIS_KEYS.exportProgress(exportId));
    return val ? parseInt(val, 10) : 0;
  }

  async setExportProgress(exportId: string, progress: number): Promise<void> {
    await this.client.setex(REDIS_KEYS.exportProgress(exportId), 3600, String(progress));
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

export const redisService = new RedisService();
