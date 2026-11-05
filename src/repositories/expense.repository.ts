import { Types, FilterQuery } from 'mongoose';
import { ExpenseModel, IExpense, IExpenseLean } from '../schemas/expense.schema';
import { BaseRepository } from './base.repository';
import { UserTotal } from '../common/utils';

export interface ExpenseListFilter {
  groupId: string;
  search?: string;
  paidBy?: string;
  from?: Date;
  to?: Date;
  sortBy: string;
  order: 'asc' | 'desc';
  skip: number;
  limit: number;
}

interface TotalRow {
  _id: Types.ObjectId;
  total: number;
}

export class ExpenseRepository extends BaseRepository<IExpense> {
  constructor() {
    super(ExpenseModel);
  }

  async findActive(groupId: string, expenseId: string): Promise<IExpense | null> {
    return this.model
      .findOne({ _id: new Types.ObjectId(expenseId), groupId: new Types.ObjectId(groupId), isDeleted: false })
      .exec();
  }

  /** One round trip for the page and the total, via $facet. */
  async listWithTotal(filter: ExpenseListFilter): Promise<{ items: IExpenseLean[]; total: number }> {
    const match: FilterQuery<IExpense> = {
      groupId: new Types.ObjectId(filter.groupId),
      isDeleted: false,
    };
    if (filter.search) match.$text = { $search: filter.search };
    if (filter.paidBy) match.paidBy = new Types.ObjectId(filter.paidBy);
    if (filter.from || filter.to) {
      match.expenseDate = {
        ...(filter.from && { $gte: filter.from }),
        ...(filter.to && { $lte: filter.to }),
      };
    }

    const direction = filter.order === 'asc' ? 1 : -1;
    const [result] = await this.model.aggregate<{ items: IExpenseLean[]; total: Array<{ count: number }> }>([
      { $match: match },
      {
        $facet: {
          items: [
            { $sort: { [filter.sortBy]: direction, _id: direction } },
            { $skip: filter.skip },
            { $limit: filter.limit },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    return { items: result?.items ?? [], total: result?.total[0]?.count ?? 0 };
  }

  /** Every live expense of a group, oldest first (used by CSV export). */
  async findAllByGroup(groupId: string): Promise<IExpenseLean[]> {
    return this.model
      .find({ groupId: new Types.ObjectId(groupId), isDeleted: false })
      .sort({ expenseDate: 1, _id: 1 })
      .lean<IExpenseLean[]>()
      .exec();
  }

  /** Per-member totals paid and owed (shares) across non-deleted expenses. */
  async totalsByGroup(groupId: string): Promise<{ paid: UserTotal[]; owed: UserTotal[] }> {
    const [row] = await this.model.aggregate<{ paid: TotalRow[]; owed: TotalRow[] }>([
      { $match: { groupId: new Types.ObjectId(groupId), isDeleted: false } },
      {
        $facet: {
          paid: [{ $group: { _id: '$paidBy', total: { $sum: '$amount' } } }],
          owed: [{ $unwind: '$splits' }, { $group: { _id: '$splits.userId', total: { $sum: '$splits.share' } } }],
        },
      },
    ]);
    const toTotals = (rows: TotalRow[] | undefined): UserTotal[] =>
      (rows ?? []).map((r) => ({ userId: String(r._id), total: r.total }));
    return { paid: toTotals(row?.paid), owed: toTotals(row?.owed) };
  }

  async softDelete(groupId: string, expenseId: string): Promise<IExpense | null> {
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(expenseId), groupId: new Types.ObjectId(groupId), isDeleted: false },
        { isDeleted: true },
        { new: true },
      )
      .exec();
  }
}
