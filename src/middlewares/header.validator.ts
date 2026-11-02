import { Request, Response, NextFunction } from 'express';
import { DEVICE_TYPES, SUPPORTED_LANGS } from '../common/constant';
import { Errors } from '../common/errors';
import { sendError } from '../common/responses';
import { DeviceType } from '../enum/enum';

export function headerValidator(req: Request, res: Response, next: NextFunction): void {
  const deviceId = req.headers['device_id'] as string | undefined;
  const deviceType = req.headers['device_type'] as string | undefined;
  const timezone = req.headers['timezone'] as string | undefined;
  const lang = req.headers['lang'] as string | undefined;

  if (!deviceId || deviceId.trim() === '') {
    const err = Errors.deviceIdRequired();
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  const deviceTypeNum = Number(deviceType);
  if (!deviceType || !DEVICE_TYPES.includes(deviceTypeNum as DeviceType)) {
    const err = Errors.deviceTypeRequired();
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  if (!timezone || timezone.trim() === '') {
    const err = Errors.timezoneRequired();
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  if (!lang || !SUPPORTED_LANGS.includes(lang as 'en' | 'hi')) {
    const err = Errors.langRequired();
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  req.device = { deviceId, deviceType: deviceTypeNum, timezone, lang };
  next();
}
