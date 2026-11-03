import mongoose, { Types } from 'mongoose';
import { ExpenseRepository } from '../../../repositories/expense.repository';
import { GroupRepository } from '../../../repositories/group.repository';
import { Errors } from '../../../common/errors';
import { SplitType, QueueName, EventType } from '../../../enum/enum';
import { equalSplit, percentToShares, parsePagination } from '../../../common/utils';
import { IExpense, IExpenseSplit } from '../../../schemas/expense.schema';
import { publishToQueue, buildMessage } from '../../../providers/rabbitmq/rabbitmq.publisher';
import { redisService } from '../../../providers/redis/redis.service';

const expenseRepo = new ExpenseRepository();
const groupRepo = new GroupRepository();

interface SplitInput {
  userId: string;
  share?: number;
  percent?: number;
}

function buildSplits(
  splitType: SplitType,
  amount: number,
  participants: string[] | undefined,
  splits: SplitInput[] | undefined,
  groupMemberIds: string[],
): IExpenseSplit[] {
  if (splitType === SplitType.EQUAL) {
    if (!participants?.length) throw Errors.validationError('participants required for EQUAL split');
    for (const uid of participants) {
      if (!groupMemberIds.includes(uid)) throw Errors.notGroupMember();
    }
    const shares = equalSplit(amount, participants.length);
    return participants.map((userId, i) => ({
      userId: new Types.ObjectId(userId),
      share: shares[i]!,
    })) as unknown as IExpenseSplit[];
  }

  if (splitType === SplitType.EXACT) {
    if (!splits?.length) throw Errors.validationError('splits required for EXACT split');
    const total = splits.reduce((sum, s) => sum + (s.share ?? 0), 0);
    if (total !== amount) throw Errors.splitTotalMismatch();
    for (const s of splits) {
      if (!groupMemberIds.includes(s.userId)) throw Errors.notGroupMember();
    }
    return splits.map((s) => ({
      userId: new Types.ObjectId(s.userId),
      share: s.share!,
    })) as unknown as IExpenseSplit[];
  }

  // PERCENT
  if (!splits?.length) throw Errors.validationError('splits required for PERCENT split');
  const totalPercent = splits.reduce((sum, s) => sum + (s.percent ?? 0), 0);
  if (Math.round(totalPercent) !== 100) throw Errors.splitTotalMismatch();
  for (const s of splits) {
    if (!groupMemberIds.includes(s.userId)) throw Errors.notGroupMember();
  }
  const percents = splits.map((s) => s.percent!);
  const shares = percentToShares(amount, percents);
  return splits.map((s, i) => ({
    userId: new Types.ObjectId(s.userId),
    share: shares[i]!,
  })) as unknown as IExpenseSplit[];
}

export class ExpenseService {
  async addExpense(
    groupId: string,
    data: {
      description: string;
      amount: number;
      paidBy: string;
      splitType: SplitType;
      participants?: string[];
      splits?: SplitInput[];
      expenseDate: string;
    },
    createdBy: string,
  ): Promise<IExpense> {
    const group = await groupRepo.findById(groupId);
    if (!group) throw Errors.notFound('Group');

    const memberIds = group.members.map((m) => String(m.userId));
    if (!memberIds.includes(data.paidBy)) throw Errors.notGroupMember();

    const splits = buildSplits(data.splitType, data.amount, data.participants, data.splits, memberIds);

    const expense = await expenseRepo.create({
      groupId: new Types.ObjectId(groupId) as unknown as mongoose.Types.ObjectId,
      description: data.description,
      amount: data.amount,
      paidBy: new Types.ObjectId(data.paidBy) as unknown as mongoose.Types.ObjectId,
      splitType: data.splitType,
      splits,
      expenseDate: new Date(data.expenseDate),
      createdBy: new Types.ObjectId(createdBy) as unknown as mongoose.Types.ObjectId,
    });

    await redisService.invalidateGroupBalances(groupId);
    publishToQueue(QueueName.BALANCE_RECALCULATE, buildMessage(EventType.EXPENSE_CREATED, { groupId, expenseId: String(expense._id) }));
    publishToQueue(QueueName.NOTIFICATION, buildMessage(EventType.EXPENSE_CREATED, { groupId, expenseId: String(expense._id), createdBy }));

    return expense;
  }

  async listExpenses(
    groupId: string,
    query: Record<string, unknown>,
  ): Promise<{ items: IExpense[]; total: number; page: number; limit: number }> {
    const { page, limit, skip } = parsePagination(query);
    const result = await expenseRepo.listWithTotal({
      groupId,
      search: query['search'] as string | undefined,
      paidBy: query['paidBy'] as string | undefined,
      from: query['from'] ? new Date(query['from'] as string) : undefined,
      to: query['to'] ? new Date(query['to'] as string) : undefined,
      sortBy: (query['sortBy'] as string) ?? 'expenseDate',
      order: (query['order'] as 'asc' | 'desc') ?? 'desc',
      skip,
      limit,
    });
    return { ...result, page, limit };
  }

  async getExpense(groupId: string, expenseId: string): Promise<IExpense> {
    const expense = await expenseRepo.findOne({
      _id: new Types.ObjectId(expenseId),
      groupId: new Types.ObjectId(groupId),
      isDeleted: false,
    });
    if (!expense) throw Errors.notFound('Expense');
    return expense;
  }

  async updateExpense(
    groupId: string,
    expenseId: string,
    data: Partial<{
      description: string;
      amount: number;
      paidBy: string;
      splitType: SplitType;
      participants: string[];
      splits: SplitInput[];
      expenseDate: string;
    }>,
  ): Promise<IExpense> {
    const existing = await this.getExpense(groupId, expenseId);
    const group = await groupRepo.findById(groupId);
    if (!group) throw Errors.notFound('Group');
    const memberIds = group.members.map((m) => String(m.userId));

    const newAmount = data.amount ?? existing.amount;
    const newSplitType = data.splitType ?? existing.splitType;
    const newSplits = buildSplits(newSplitType, newAmount, data.participants, data.splits, memberIds);

    const updated = await expenseRepo.updateById(expenseId, {
      ...(data.description && { description: data.description }),
      ...(data.amount && { amount: data.amount }),
      ...(data.paidBy && { paidBy: new Types.ObjectId(data.paidBy) }),
      ...(data.splitType && { splitType: data.splitType }),
      ...(data.expenseDate && { expenseDate: new Date(data.expenseDate) }),
      splits: newSplits,
    });
    if (!updated) throw Errors.notFound('Expense');

    await redisService.invalidateGroupBalances(groupId);
    publishToQueue(QueueName.BALANCE_RECALCULATE, buildMessage(EventType.EXPENSE_UPDATED, { groupId, expenseId }));

    return updated;
  }

  async deleteExpense(groupId: string, expenseId: string): Promise<void> {
    const expense = await this.getExpense(groupId, expenseId);
    await expenseRepo.softDelete(String(expense._id));

    await redisService.invalidateGroupBalances(groupId);
    publishToQueue(QueueName.BALANCE_RECALCULATE, buildMessage(EventType.EXPENSE_DELETED, { groupId, expenseId }));
  }
}

export const expenseService = new ExpenseService();
