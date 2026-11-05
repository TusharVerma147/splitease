import { Types, UpdateQuery } from 'mongoose';
import { ExpenseRepository } from '../../../repositories/expense.repository';
import { GroupRepository } from '../../../repositories/group.repository';
import { Errors } from '../../../common/errors';
import { SplitType, QueueName, EventType } from '../../../enum/enum';
import { calculateSplits, parsePagination } from '../../../common/utils';
import { paginated, PaginatedData } from '../../../common/responses';
import { IExpense, IExpenseLean } from '../../../schemas/expense.schema';
import { publishEvent } from '../../../providers/rabbitmq/rabbitmq.publisher';
import { redisService } from '../../../providers/redis/redis.service';
import { CreateExpenseDto, ListExpensesQueryDto, UpdateExpenseDto } from './dto/expense.dto';
import { ExpenseView } from './interface/expense.interface';

const expenseRepo = new ExpenseRepository();
const groupRepo = new GroupRepository();

type ExpenseLike = IExpense | IExpenseLean;

export function toExpenseView(expense: ExpenseLike): ExpenseView {
  return {
    id: String(expense._id),
    groupId: String(expense.groupId),
    description: expense.description,
    amount: expense.amount,
    paidBy: String(expense.paidBy),
    splitType: expense.splitType,
    splits: expense.splits.map((s) => ({ userId: String(s.userId), share: s.share })),
    expenseDate: expense.expenseDate,
    createdBy: String(expense.createdBy),
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

/** `to=2026-10-31` should include the whole day. */
function endOfRange(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T23:59:59.999Z`) : new Date(value);
}

export class ExpenseService {
  private async memberIds(groupId: string): Promise<string[]> {
    const group = await groupRepo.findActiveById(groupId);
    if (!group) throw Errors.notFound('Group');
    return group.members.map((m) => String(m.userId));
  }

  /** Marks cached balances stale and tells the consumers to recalculate + notify. */
  private async publishChange(
    eventType: EventType,
    groupId: string,
    expense: ExpenseLike,
    actorId: string,
  ): Promise<void> {
    await redisService.bumpBalanceVersion(groupId);
    await publishEvent([QueueName.BALANCE_RECALCULATE, QueueName.NOTIFICATION], eventType, {
      groupId,
      expenseId: String(expense._id),
      description: expense.description,
      amount: expense.amount,
      actorId,
    });
  }

  async addExpense(groupId: string, data: CreateExpenseDto, createdBy: string): Promise<ExpenseView> {
    const memberIds = await this.memberIds(groupId);
    if (!memberIds.includes(data.paidBy)) throw Errors.notGroupMember('paidBy is not a member of this group');

    const splits = calculateSplits(data.splitType, data.amount, data, memberIds);

    const expense = await expenseRepo.create({
      groupId: new Types.ObjectId(groupId),
      description: data.description,
      amount: data.amount,
      paidBy: new Types.ObjectId(data.paidBy),
      splitType: data.splitType,
      splits: splits.map((s) => ({ userId: new Types.ObjectId(s.userId), share: s.share })),
      expenseDate: new Date(data.expenseDate),
      createdBy: new Types.ObjectId(createdBy),
    });

    await this.publishChange(EventType.EXPENSE_CREATED, groupId, expense, createdBy);
    return toExpenseView(expense);
  }

  async listExpenses(groupId: string, query: ListExpensesQueryDto): Promise<PaginatedData<ExpenseView>> {
    const { page, limit, skip } = parsePagination(query);
    const { items, total } = await expenseRepo.listWithTotal({
      groupId,
      search: query.search,
      paidBy: query.paidBy,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? endOfRange(query.to) : undefined,
      sortBy: query.sortBy,
      order: query.order,
      skip,
      limit,
    });
    return paginated(items.map(toExpenseView), total, page, limit);
  }

  async getExpense(groupId: string, expenseId: string): Promise<ExpenseView> {
    return toExpenseView(await this.getExpenseDoc(groupId, expenseId));
  }

  private async getExpenseDoc(groupId: string, expenseId: string): Promise<IExpense> {
    const expense = await expenseRepo.findActive(groupId, expenseId);
    if (!expense) throw Errors.notFound('Expense');
    return expense;
  }

  /**
   * PATCH semantics: only the sent fields change. Splits are re-validated and rebuilt
   * whenever something they depend on (amount, splitType, participants, splits) changes.
   */
  async updateExpense(
    groupId: string,
    expenseId: string,
    data: UpdateExpenseDto,
    actorId: string,
  ): Promise<ExpenseView> {
    const existing = await this.getExpenseDoc(groupId, expenseId);
    const memberIds = await this.memberIds(groupId);

    if (data.paidBy && !memberIds.includes(data.paidBy)) {
      throw Errors.notGroupMember('paidBy is not a member of this group');
    }

    const update: UpdateQuery<IExpense> = {};
    if (data.description !== undefined) update.description = data.description;
    if (data.amount !== undefined) update.amount = data.amount;
    if (data.paidBy !== undefined) update.paidBy = new Types.ObjectId(data.paidBy);
    if (data.splitType !== undefined) update.splitType = data.splitType;
    if (data.expenseDate !== undefined) update.expenseDate = new Date(data.expenseDate);

    const splitsAffected =
      data.amount !== undefined || data.splitType !== undefined || !!data.participants || !!data.splits;
    if (splitsAffected) {
      const amount = data.amount ?? existing.amount;
      const splitType = data.splitType ?? existing.splitType;
      const participants =
        splitType === SplitType.EQUAL ? (data.participants ?? existing.splits.map((s) => String(s.userId))) : undefined;

      const splits = calculateSplits(splitType, amount, { participants, splits: data.splits }, memberIds);
      update.splits = splits.map((s) => ({ userId: new Types.ObjectId(s.userId), share: s.share }));
    }

    const updated = await expenseRepo.updateById(expenseId, update);
    if (!updated) throw Errors.notFound('Expense');

    await this.publishChange(EventType.EXPENSE_UPDATED, groupId, updated, actorId);
    return toExpenseView(updated);
  }

  async deleteExpense(groupId: string, expenseId: string, actorId: string): Promise<void> {
    const deleted = await expenseRepo.softDelete(groupId, expenseId);
    if (!deleted) throw Errors.notFound('Expense');

    await this.publishChange(EventType.EXPENSE_DELETED, groupId, deleted, actorId);
  }
}

export const expenseService = new ExpenseService();
