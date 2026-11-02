import { SessionModel, ISession } from '../schemas/session.schema';
import { BaseRepository } from './base.repository';
import mongoose from 'mongoose';

export class SessionRepository extends BaseRepository<ISession> {
  constructor() {
    super(SessionModel);
  }

  async findActiveByUserAndDevice(userId: string, deviceId: string): Promise<ISession | null> {
    return this.model
      .findOne({ userId: new mongoose.Types.ObjectId(userId), deviceId, revokedAt: null })
      .exec();
  }

  async findAllActiveByUser(userId: string): Promise<ISession[]> {
    return this.model
      .find({ userId: new mongoose.Types.ObjectId(userId), revokedAt: null })
      .sort({ lastUsedAt: -1 })
      .exec();
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.model.findByIdAndUpdate(sessionId, { revokedAt: new Date() }).exec();
  }

  async revokeAllByUser(userId: string): Promise<void> {
    await this.model
      .updateMany(
        { userId: new mongoose.Types.ObjectId(userId), revokedAt: null },
        { revokedAt: new Date() },
      )
      .exec();
  }

  async updateLastUsed(sessionId: string): Promise<void> {
    await this.model.findByIdAndUpdate(sessionId, { lastUsedAt: new Date() }).exec();
  }
}
