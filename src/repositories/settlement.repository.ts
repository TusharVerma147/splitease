import { SettlementModel, ISettlement } from '../schemas/settlement.schema';
import { BaseRepository } from './base.repository';
import mongoose from 'mongoose';

export class SettlementRepository extends BaseRepository<ISettlement> {
  constructor() {
    super(SettlementModel);
  }

  async listByGroup(
    groupId: string,
    skip: number,
    limit: number,
  ): Promise<{ items: ISettlement[]; total: number }> {
    const filter = { groupId: new mongoose.Types.ObjectId(groupId) };
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
