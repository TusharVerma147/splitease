import { Request, Response, NextFunction } from 'express';
import { DEVICE_TYPES, SUPPORTED_LANGS } from '../common/constant';
import { Errors } from '../common/errors';

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  const single = Array.isArray(value) ? value[0] : value;
  const trimmed = single?.trim();
  return trimmed ? trimmed : undefined;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** device_id, device_type, timezone and lang are required on every /api request. */
export function headerValidator(req: Request, _res: Response, next: NextFunction): void {
  // CORS preflight carries no custom headers.
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const deviceId = header(req, 'device_id');
  if (!deviceId) return next(Errors.deviceIdRequired());

  const deviceTypeRaw = header(req, 'device_type');
  const deviceType = Number(deviceTypeRaw);
  if (!deviceTypeRaw || !(DEVICE_TYPES as readonly number[]).includes(deviceType)) {
    return next(Errors.deviceTypeRequired());
  }

  const timezone = header(req, 'timezone');
  if (!timezone || !isValidTimezone(timezone)) return next(Errors.timezoneRequired());

  const lang = header(req, 'lang');
  if (!lang || !(SUPPORTED_LANGS as readonly string[]).includes(lang)) return next(Errors.langRequired());

  req.device = { deviceId, deviceType, timezone, lang };
  next();
}
