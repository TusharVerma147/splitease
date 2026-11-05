import { Request, Response } from 'express';
import { groupService } from './group.service';
import { sendSuccess } from '../../../common/responses';
import { AddMemberDto, CreateGroupDto, ListGroupsQueryDto, UpdateGroupDto } from './dto/group.dto';

export class GroupController {
  createGroup = async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body as CreateGroupDto;
    const group = await groupService.createGroup(name, req.user?.userId ?? '');
    sendSuccess(res, { group }, 'Group created', 201);
  };

  getMyGroups = async (req: Request, res: Response): Promise<void> => {
    const result = await groupService.getMyGroups(req.user?.userId ?? '', req.query as unknown as ListGroupsQueryDto);
    sendSuccess(res, result, 'Groups fetched');
  };

  getGroup = async (req: Request, res: Response): Promise<void> => {
    const group = await groupService.getGroup(req.params['groupId'] ?? '');
    sendSuccess(res, { group }, 'Group fetched');
  };

  updateGroup = async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body as UpdateGroupDto;
    const group = await groupService.updateGroup(req.params['groupId'] ?? '', name);
    sendSuccess(res, { group }, 'Group updated');
  };

  addMember = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as AddMemberDto;
    const group = await groupService.addMember(req.params['groupId'] ?? '', email, req.user?.userId ?? '');
    sendSuccess(res, { group }, 'Member added');
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    await groupService.removeMember(req.params['groupId'] ?? '', req.params['userId'] ?? '');
    sendSuccess(res, {}, 'Member removed');
  };
}

export const groupController = new GroupController();
