export const DEVICE_TYPES = [1, 2, 3] as const;

export const SUPPORTED_LANGS = ['en', 'hi'] as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const REDIS_KEYS = {
  session: (sid: string) => `session:${sid}`,
  refreshToken: (jti: string) => `rt:${jti}`,
  loginAttempts: (email: string, ip: string) => `login_attempts:${email}:${ip}`,
  groupBalances: (groupId: string) => `balances:${groupId}`,
  exportProgress: (exportId: string) => `export_progress:${exportId}`,
  balanceStale: (groupId: string) => `balance_stale:${groupId}`,
} as const;

export const TOKEN_EXPIRY = {
  ACCESS_SECONDS: 15 * 60,
  REFRESH_SECONDS: 7 * 24 * 60 * 60,
  SESSION_SECONDS: 7 * 24 * 60 * 60,
} as const;
