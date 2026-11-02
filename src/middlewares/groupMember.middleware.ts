import { Request, Response, NextFunction } from 'express';
import { Errors } from '../common/errors';
import { sendError } from '../common/responses';
import { GroupRepository } from '../repositories/group.repository';

const groupRepo = new GroupRepository();

export async function groupMemberMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const groupId = req.params['groupId'];
  const userId = req.user?.userId;

  if (!userId || !groupId) {
    const err = Errors.unauthorized();
    sendError(res, err.statusCode, err.code, err.message, req.requestId);
    return;
  }

  const isMember = await groupRepo.isMember(groupId, userId);
  if (!isMember) {
    const err = Errors.notGroupMember();
    sendError(res, err.statusCode, err.code, err.message, req.requestId);
    return;
  }

  next();
}
