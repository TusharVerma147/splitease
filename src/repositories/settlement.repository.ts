import { Types } from 'mongoose';
import { SettlementModel, ISettlement } from '../schemas/settlement.schema';
import { BaseRepository } from './base.repository';
import { UserTotal } from '../common/utils';

interface TotalRow {
  _id: Types.ObjectId;
  total: number;
}

export class SettlementRepository extends BaseRepository<ISettlement> {
  constructor() {
    super(SettlementModel);
  }

  async listByGroup(
    groupId: string,
    skip: number,
    limit: number,
    sortBy: string,
    order: 'asc' | 'desc',
  ): Promise<{ items: ISettlement[]; total: number }> {
    const filter = { groupId: new Types.ObjectId(groupId) };
    const direction = order === 'asc' ? 1 : -1;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ [sortBy]: direction, _id: direction })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  /** What each member has paid to / received from others through settlements. */
  async totalsByGroup(groupId: string): Promise<{ paid: UserTotal[]; received: UserTotal[] }> {
    const [row] = await this.model.aggregate<{ paid: TotalRow[]; received: TotalRow[] }>([
      { $match: { groupId: new Types.ObjectId(groupId) } },
      {
        $facet: {
          paid: [{ $group: { _id: '$fromUserId', total: { $sum: '$amount' } } }],
          received: [{ $group: { _id: '$toUserId', total: { $sum: '$amount' } } }],
        },
      },
    ]);
    const toTotals = (rows: TotalRow[] | undefined): UserTotal[] =>
      (rows ?? []).map((r) => ({ userId: String(r._id), total: r.total }));
    return { paid: toTotals(row?.paid), received: toTotals(row?.received) };
  }
}
