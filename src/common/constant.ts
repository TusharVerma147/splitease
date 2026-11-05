export const DEVICE_TYPES = [1, 2, 3] as const;

export const SUPPORTED_LANGS = ['en', 'hi'] as const;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const REDIS_KEYS = {
  session: (sid: string) => `session:${sid}`,
  /** Current (only valid) refresh-token jti of a session. */
  refreshJti: (sid: string) => `rt:${sid}`,
  loginAttempts: (email: string, ip: string) => `login_attempts:${email}:${ip}`,
  groupBalances: (groupId: string) => `balances:${groupId}`,
  /** Monotonic counter bumped on every write that changes a group's balances. */
  balanceVersion: (groupId: string) => `balance_ver:${groupId}`,
  exportProgress: (exportId: string) => `export_progress:${exportId}`,
  processedMessage: (consumer: string, messageId: string) => `processed:${consumer}:${messageId}`,
} as const;

export const TOKEN_EXPIRY = {
  ACCESS_SECONDS: 15 * 60,
  REFRESH_SECONDS: 7 * 24 * 60 * 60,
  SESSION_SECONDS: 7 * 24 * 60 * 60,
} as const;

export const BALANCE_CACHE_SECONDS = 24 * 60 * 60;
export const EXPORT_PROGRESS_SECONDS = 60 * 60;
export const PROCESSED_MESSAGE_SECONDS = 24 * 60 * 60;

export const QUEUE_MAX_RETRIES = 3;
export const QUEUE_RETRY_DELAY_MS = 1000;

export const SHUTDOWN_TIMEOUT_MS = 15000;
