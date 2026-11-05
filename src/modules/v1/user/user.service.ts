import { UserRepository } from '../../../repositories/user.repository';
import { Errors } from '../../../common/errors';
import { IUser } from '../../../schemas/user.schema';
import { PublicUser } from './interface/user.interface';

const userRepo = new UserRepository();

function toPublicUser(user: IUser): PublicUser {
  return { id: String(user._id), name: user.name, email: user.email };
}

export class UserService {
  async getMe(userId: string): Promise<PublicUser> {
    const user = await userRepo.findById(userId);
    if (!user || !user.isActive) throw Errors.notFound('User');
    return toPublicUser(user);
  }

  async updateMe(userId: string, name: string): Promise<PublicUser> {
    const user = await userRepo.updateById(userId, { name });
    if (!user) throw Errors.notFound('User');
    return toPublicUser(user);
  }

  /** Exact (case-insensitive) email match, used to find someone to add to a group. */
  async searchByEmail(email: string): Promise<PublicUser> {
    const user = await userRepo.findByEmail(email);
    if (!user || !user.isActive) throw Errors.notFound('User');
    return toPublicUser(user);
  }
}

export const userService = new UserService();
