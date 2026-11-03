import { Request, Response } from 'express';
import { expenseService } from './expense.service';
import { sendSuccess, sendError, paginated } from '../../../common/responses';
import { AppError } from '../../../common/errors';
import { SplitType } from '../../../enum/enum';

interface ExpenseBody {
  description: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  participants?: string[];
  splits?: Array<{ userId: string; share?: number; percent?: number }>;
  expenseDate: string;
}

export class ExpenseController {
  async addExpense(req: Request, res: Response): Promise<void> {
    try {
      const expense = await expenseService.addExpense(
        req.params['groupId']!,
        req.body as ExpenseBody,
        req.user!.userId,
      );
      sendSuccess(res, { expense }, 'Expense added', 201);
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async listExpenses(req: Request, res: Response): Promise<void> {
    try {
      const result = await expenseService.listExpenses(req.params['groupId']!, req.query as Record<string, unknown>);
      sendSuccess(res, paginated(result.items, result.total, result.page, result.limit), 'Expenses fetched');
    } catch (err) {
      sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async getExpense(req: Request, res: Response): Promise<void> {
    try {
      const expense = await expenseService.getExpense(req.params['groupId']!, req.params['expenseId']!);
      sendSuccess(res, { expense }, 'Expense fetched');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async updateExpense(req: Request, res: Response): Promise<void> {
    try {
      const expense = await expenseService.updateExpense(
        req.params['groupId']!,
        req.params['expenseId']!,
        req.body as Partial<ExpenseBody>,
      );
      sendSuccess(res, { expense }, 'Expense updated');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }

  async deleteExpense(req: Request, res: Response): Promise<void> {
    try {
      await expenseService.deleteExpense(req.params['groupId']!, req.params['expenseId']!);
      sendSuccess(res, {}, 'Expense deleted');
    } catch (err) {
      if (err instanceof AppError) sendError(res, err.statusCode, err.code, err.message, req.requestId);
      else sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', req.requestId);
    }
  }
}

export const expenseController = new ExpenseController();
