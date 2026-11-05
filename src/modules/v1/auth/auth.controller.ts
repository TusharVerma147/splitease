import { Request, Response } from 'express';
import { authService } from './auth.service';
import { sendSuccess } from '../../../common/responses';
import { Errors } from '../../../common/errors';
import { DeviceInfo } from '../../../interfaces';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { TokenPair } from './interface/auth.interface';

/** Tokens travel only in response headers, never in cookies or the body. */
function setTokenHeaders(res: Response, tokens: TokenPair): void {
  res.setHeader('x-access-token', tokens.accessToken);
  res.setHeader('x-refresh-token', tokens.refreshToken);
}

export class AuthController {
  register = async (req: Request, res: Response): Promise<void> => {
    const result = await authService.register(req.body as RegisterDto, req.device as DeviceInfo);
    setTokenHeaders(res, result.tokens);
    sendSuccess(res, { user: result.user }, 'Account created', 201);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as LoginDto;
    const result = await authService.login(email, password, req.device as DeviceInfo);
    setTokenHeaders(res, result.tokens);
    sendSuccess(res, { user: result.user }, 'Logged in');
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const payload = req.refreshPayload;
    if (!payload) throw Errors.unauthorized();
    const tokens = await authService.refresh(payload.sub, payload.sid, payload.jti, req.device as DeviceInfo);
    setTokenHeaders(res, tokens);
    sendSuccess(res, {}, 'Tokens refreshed');
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await authService.logout(req.user?.sessionId ?? '');
    sendSuccess(res, {}, 'Logged out');
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    await authService.logoutAll(req.user?.userId ?? '');
    sendSuccess(res, {}, 'Logged out from all devices');
  };

  sessions = async (req: Request, res: Response): Promise<void> => {
    const sessions = await authService.getSessions(req.user?.userId ?? '', req.user?.sessionId ?? '');
    sendSuccess(res, { sessions }, 'Sessions fetched');
  };
}

export const authController = new AuthController();
