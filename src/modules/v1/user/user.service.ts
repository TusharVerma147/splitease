import { UserRepository } from '../../../repositories/user.repository';
import { Errors } from '../../../common/errors';
import { IUser } from '../../../schemas/user.schema';

const userRepo = new UserRepository();

export class UserService {
  async getMe(userId: string): Promise<IUser> {
    const user = await userRepo.findById(userId);
    if (!user) throw Errors.notFound('User');
    return user;
  }

  async updateMe(userId: string, name: string): Promise<IUser> {
    const user = await userRepo.updateById(userId, { name });
    if (!user) throw Errors.notFound('User');
    return user;
  }

  async searchByEmail(email: string): Promise<IUser | null> {
    return userRepo.findByEmail(email);
  }
}

export const userService = new UserService();
