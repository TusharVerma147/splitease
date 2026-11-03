import { Request, Response } from 'express';
import { groupService } from './group.service';
import { sendSuccess, sendError } from '../../../common/responses';
import { AppError } from '../../../common/errors';

export class GroupController {
  async createGroup(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.body as { name: string };
      const group = await groupService.createGroup(name, req.user!.userId);
      sendSuccess(res, { group }, 'Group created', 201);
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async getMyGroups(req: Request, res: Response): Promise<void> {
    try {
      const groups = await groupService.getMyGroups(req.user!.userId);
      sendSuccess(res, { groups }, 'Groups fetched');
    } catch (err) {
      sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async getGroup(req: Request, res: Response): Promise<void> {
    try {
      const group = await groupService.getGroup(req.params['groupId']!);
      sendSuccess(res, { group }, 'Group fetched');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async updateGroup(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.body as { name: string };
      const group = await groupService.updateGroup(req.params['groupId']!, name);
      sendSuccess(res, { group }, 'Group updated');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async addMember(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body as { email: string };
      const group = await groupService.addMember(req.params['groupId']!, email, req.user!.userId);
      sendSuccess(res, { group }, 'Member added');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      await groupService.removeMember(req.params['groupId']!, req.params['userId']!);
      sendSuccess(res, {}, 'Member removed');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }
}

export const groupController = new GroupController();
