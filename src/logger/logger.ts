import winston from 'winston';

const redactTokens = winston.format((info) => {
  const msg = JSON.stringify(info);
  const redacted = msg.replace(
    /(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g,
    '[REDACTED_JWT]',
  );
  return JSON.parse(redacted) as winston.Logform.TransformableInfo;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    redactTokens(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${String(timestamp)} [${level.toUpperCase()}] ${String(message)} ${metaStr}`;
        }),
  ),
  transports: [new winston.transports.Console()],
});
