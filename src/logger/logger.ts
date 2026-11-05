import winston from 'winston';

const SENSITIVE_KEY =
  /^(authorization|x-access-token|x-refresh-token|accesstoken|refreshtoken|password|passwordhash|token)$/i;
const JWT_PATTERN = /eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;
const MAX_DEPTH = 6;

/** Deep-copies a value, masking JWTs and well-known secret keys. Safe on cycles and Errors. */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet(), depth = 0): unknown {
  if (typeof value === 'string') return value.replace(JWT_PATTERN, '[REDACTED_JWT]');
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_DEPTH) return '[Truncated]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redact(value.message, seen, depth + 1),
      stack: redact(value.stack, seen, depth + 1),
    };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, seen, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(v, seen, depth + 1);
  }
  return out;
}

const redactFormat = winston.format((info) => {
  const record = info as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === 'level') continue;
    record[key] = redact(record[key]);
  }
  return info;
});

const isProduction = process.env['NODE_ENV'] === 'production';

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat(),
    isProduction
      ? winston.format.json()
      : winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${String(timestamp)} [${level.toUpperCase()}] ${String(message)} ${metaStr}`;
        }),
  ),
  transports: [new winston.transports.Console()],
});
