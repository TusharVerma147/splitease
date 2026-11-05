import { Request, Response } from 'express';
import { userService } from './user.service';
import { sendSuccess } from '../../../common/responses';
import { SearchUserQueryDto, UpdateMeDto } from './dto/user.dto';

export class UserController {
  getMe = async (req: Request, res: Response): Promise<void> => {
    const user = await userService.getMe(req.user?.userId ?? '');
    sendSuccess(res, user, 'Profile fetched');
  };

  updateMe = async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body as UpdateMeDto;
    const user = await userService.updateMe(req.user?.userId ?? '', name);
    sendSuccess(res, user, 'Profile updated');
  };

  searchByEmail = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.query as unknown as SearchUserQueryDto;
    const user = await userService.searchByEmail(email);
    sendSuccess(res, user, 'User found');
  };
}

export const userController = new UserController();
