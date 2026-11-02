export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'DEVICE_ID_REQUIRED'
  | 'DEVICE_TYPE_REQUIRED'
  | 'TIMEZONE_REQUIRED'
  | 'LANG_REQUIRED'
  | 'SPLIT_TOTAL_MISMATCH'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'REFRESH_TOKEN_REUSED'
  | 'NOT_GROUP_MEMBER'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'ALREADY_MEMBER'
  | 'BALANCE_NOT_SETTLED'
  | 'TOO_MANY_ATTEMPTS'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const Errors = {
  validationError: (message: string) => new AppError(400, 'VALIDATION_ERROR', message),
  deviceIdRequired: () => new AppError(400, 'DEVICE_ID_REQUIRED', 'device_id header is required'),
  deviceTypeRequired: () => new AppError(400, 'DEVICE_TYPE_REQUIRED', 'device_type must be 1 (Android), 2 (iOS), or 3 (Web)'),
  timezoneRequired: () => new AppError(400, 'TIMEZONE_REQUIRED', 'timezone header is required'),
  langRequired: () => new AppError(400, 'LANG_REQUIRED', 'lang must be en or hi'),
  splitTotalMismatch: () => new AppError(400, 'SPLIT_TOTAL_MISMATCH', 'Splits must add up to the expense amount'),
  unauthorized: () => new AppError(401, 'UNAUTHORIZED', 'Unauthorized'),
  tokenExpired: () => new AppError(401, 'TOKEN_EXPIRED', 'Access token expired'),
  refreshTokenReused: () => new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token already used'),
  notGroupMember: () => new AppError(403, 'NOT_GROUP_MEMBER', 'You are not a member of this group'),
  notFound: (resource = 'Resource') => new AppError(404, 'NOT_FOUND', `${resource} not found`),
  emailTaken: () => new AppError(409, 'EMAIL_TAKEN', 'Email is already registered'),
  alreadyMember: () => new AppError(409, 'ALREADY_MEMBER', 'User is already a member of this group'),
  balanceNotSettled: () => new AppError(409, 'BALANCE_NOT_SETTLED', 'Member has an outstanding balance'),
  tooManyAttempts: () => new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many login attempts. Try again in a minute.'),
};
