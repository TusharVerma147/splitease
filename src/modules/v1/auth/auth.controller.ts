import { Request, Response } from 'express';
import { authService } from './auth.service';
import { sendSuccess, sendError } from '../../../common/responses';
import { AppError } from '../../../common/errors';
import { DeviceInfo } from '../../../interfaces';
import { RefreshTokenPayload } from '../../../middlewares/refreshToken.middleware';

function setTokenHeaders(res: Response, accessToken: string, refreshToken: string): void {
  res.setHeader('x-access-token', accessToken);
  res.setHeader('x-refresh-token', refreshToken);
}

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.register(
        req.body as { name: string; email: string; password: string },
        req.device as DeviceInfo,
      );
      setTokenHeaders(res, result.tokens.accessToken, result.tokens.refreshToken);
      sendSuccess(res, { user: result.user }, 'Account created', 201);
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const result = await authService.login(email, password, req.device as DeviceInfo);
      setTokenHeaders(res, result.tokens.accessToken, result.tokens.refreshToken);
      sendSuccess(res, { user: result.user }, 'Logged in');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const payload = (req as Request & { refreshPayload?: RefreshTokenPayload }).refreshPayload;
      if (!payload) throw new Error('No refresh payload');
      const tokens = await authService.refresh(payload.sub, payload.sid, payload.jti, req.device as DeviceInfo);
      setTokenHeaders(res, tokens.accessToken, tokens.refreshToken);
      sendSuccess(res, {}, 'Tokens refreshed');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      await authService.logout(req.user!.sessionId);
      sendSuccess(res, {}, 'Logged out');
    } catch {
      sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      await authService.logoutAll(req.user!.userId);
      sendSuccess(res, {}, 'Logged out from all devices');
    } catch {
      sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async sessions(req: Request, res: Response): Promise<void> {
    try {
      const sessions = await authService.getSessions(req.user!.userId);
      const data = sessions.map((s) => ({
        sessionId: String(s._id),
        deviceType: s.deviceType,
        timezone: s.timezone,
        lang: s.lang,
        loginAt: s.loginAt,
        lastUsedAt: s.lastUsedAt,
      }));
      sendSuccess(res, { sessions: data }, 'Sessions fetched');
    } catch {
      sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }
}

export const authController = new AuthController();
