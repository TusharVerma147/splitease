import { Request, Response } from 'express';
import { userService } from './user.service';
import { sendSuccess, sendError } from '../../../common/responses';
import { AppError } from '../../../common/errors';

export class UserController {
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.getMe(req.user!.userId);
      sendSuccess(res, { id: String(user._id), name: user.name, email: user.email }, 'Profile fetched');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async updateMe(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.body as { name: string };
      const user = await userService.updateMe(req.user!.userId, name);
      sendSuccess(res, { id: String(user._id), name: user.name, email: user.email }, 'Profile updated');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async searchByEmail(req: Request, res: Response): Promise<void> {
    try {
      const email = req.query['email'] as string;
      if (!email) {
        sendError(res, 400, 'VALIDATION_ERROR', 'email query param required', req.requestId);
        return;
      }
      const user = await userService.searchByEmail(email);
      if (!user) {
        sendError(res, 404, 'NOT_FOUND', 'User not found', req.requestId);
        return;
      }
      sendSuccess(res, { id: String(user._id), name: user.name, email: user.email }, 'User found');
    } catch {
      sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }
}

export const userController = new UserController();
