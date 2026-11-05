import { Types } from 'mongoose';
import { SessionModel, ISession } from '../schemas/session.schema';
import { BaseRepository } from './base.repository';

export class SessionRepository extends BaseRepository<ISession> {
  constructor() {
    super(SessionModel);
  }

  /** Active sessions of one user on one device (normally 0 or 1). */
  async findActiveByUserAndDevice(userId: string, deviceId: string): Promise<ISession[]> {
    return this.model.find({ userId: new Types.ObjectId(userId), deviceId, revokedAt: { $exists: false } }).exec();
  }

  async findAllActiveByUser(userId: string): Promise<ISession[]> {
    return this.model
      .find({ userId: new Types.ObjectId(userId), revokedAt: { $exists: false } })
      .sort({ lastUsedAt: -1 })
      .exec();
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.model
      .updateOne({ _id: new Types.ObjectId(sessionId), revokedAt: { $exists: false } }, { revokedAt: new Date() })
      .exec();
  }

  async revokeAllByUser(userId: string): Promise<void> {
    await this.model
      .updateMany({ userId: new Types.ObjectId(userId), revokedAt: { $exists: false } }, { revokedAt: new Date() })
      .exec();
  }

  async updateLastUsed(sessionId: string): Promise<void> {
    await this.model.updateOne({ _id: new Types.ObjectId(sessionId) }, { lastUsedAt: new Date() }).exec();
  }
}
