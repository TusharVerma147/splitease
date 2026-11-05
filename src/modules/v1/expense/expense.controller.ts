import { Request, Response } from 'express';
import { expenseService } from './expense.service';
import { sendSuccess } from '../../../common/responses';
import { CreateExpenseDto, ListExpensesQueryDto, UpdateExpenseDto } from './dto/expense.dto';

export class ExpenseController {
  addExpense = async (req: Request, res: Response): Promise<void> => {
    const expense = await expenseService.addExpense(
      req.params['groupId'] ?? '',
      req.body as CreateExpenseDto,
      req.user?.userId ?? '',
    );
    sendSuccess(res, expense, 'Expense added', 201);
  };

  listExpenses = async (req: Request, res: Response): Promise<void> => {
    const result = await expenseService.listExpenses(
      req.params['groupId'] ?? '',
      req.query as unknown as ListExpensesQueryDto,
    );
    sendSuccess(res, result, 'Expenses fetched');
  };

  getExpense = async (req: Request, res: Response): Promise<void> => {
    const expense = await expenseService.getExpense(req.params['groupId'] ?? '', req.params['expenseId'] ?? '');
    sendSuccess(res, expense, 'Expense fetched');
  };

  updateExpense = async (req: Request, res: Response): Promise<void> => {
    const expense = await expenseService.updateExpense(
      req.params['groupId'] ?? '',
      req.params['expenseId'] ?? '',
      req.body as UpdateExpenseDto,
      req.user?.userId ?? '',
    );
    sendSuccess(res, expense, 'Expense updated');
  };

  deleteExpense = async (req: Request, res: Response): Promise<void> => {
    await expenseService.deleteExpense(
      req.params['groupId'] ?? '',
      req.params['expenseId'] ?? '',
      req.user?.userId ?? '',
    );
    sendSuccess(res, {}, 'Expense deleted');
  };
}

export const expenseController = new ExpenseController();
