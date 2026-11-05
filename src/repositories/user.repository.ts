import { Types } from 'mongoose';
import { UserModel, IUser } from '../schemas/user.schema';
import { BaseRepository } from './base.repository';

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.model.findOne({ email: email.trim().toLowerCase() }).exec();
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.model.countDocuments({ email: email.trim().toLowerCase() }).exec()) > 0;
  }

  async findByIds(ids: Array<string | Types.ObjectId>): Promise<IUser[]> {
    if (ids.length === 0) return [];
    return this.model
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(String(id))) } })
      .select('name email')
      .exec();
  }
}
