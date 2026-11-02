import { ExpenseModel, IExpense } from '../schemas/expense.schema';
import { BaseRepository } from './base.repository';
import mongoose from 'mongoose';

export interface ExpenseListFilter {
  groupId: string;
  search?: string;
  paidBy?: string;
  from?: Date;
  to?: Date;
  sortBy?: string;
  order?: 'asc' | 'desc';
  skip: number;
  limit: number;
}

export class ExpenseRepository extends BaseRepository<IExpense> {
  constructor() {
    super(ExpenseModel);
  }

  async listWithTotal(filter: ExpenseListFilter): Promise<{ items: IExpense[]; total: number }> {
    const match: mongoose.FilterQuery<IExpense> = {
      groupId: new mongoose.Types.ObjectId(filter.groupId),
      isDeleted: false,
    };

    if (filter.search) {
      match.$text = { $search: filter.search };
    }
    if (filter.paidBy) {
      match.paidBy = new mongoose.Types.ObjectId(filter.paidBy);
    }
    if (filter.from || filter.to) {
      match.expenseDate = {};
      if (filter.from) match.expenseDate.$gte = filter.from;
      if (filter.to) match.expenseDate.$lte = filter.to;
    }

    const sortField = filter.sortBy ?? 'expenseDate';
    const sortOrder = filter.order === 'asc' ? 1 : -1;

    const result = await this.model
      .aggregate([
        { $match: match },
        {
          $facet: {
            items: [
              { $sort: { [sortField]: sortOrder } },
              { $skip: filter.skip },
              { $limit: filter.limit },
            ],
            total: [{ $count: 'count' }],
          },
        },
      ])
      .exec();

    const data = result[0] as { items: IExpense[]; total: { count: number }[] };
    return {
      items: data.items,
      total: data.total[0]?.count ?? 0,
    };
  }

  async softDelete(expenseId: string): Promise<IExpense | null> {
    return this.model.findByIdAndUpdate(expenseId, { isDeleted: true }, { new: true }).exec();
  }
}
