import { Router } from 'express';
import { expenseController } from './expense.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../common/utils';
import { createExpenseDto, updateExpenseDto, listExpensesQueryDto, expenseParamsDto } from './dto/expense.dto';

/** Mounted at /groups/:groupId/expenses */
const router = Router({ mergeParams: true });
const guard = [accessTokenMiddleware, groupMemberMiddleware];

router.post('/', ...guard, validate(createExpenseDto), asyncHandler(expenseController.addExpense));
router.get('/', ...guard, validate(listExpensesQueryDto, 'query'), asyncHandler(expenseController.listExpenses));
router.get('/:expenseId', ...guard, validate(expenseParamsDto, 'params'), asyncHandler(expenseController.getExpense));
router.patch(
  '/:expenseId',
  ...guard,
  validate(expenseParamsDto, 'params'),
  validate(updateExpenseDto),
  asyncHandler(expenseController.updateExpense),
);
router.delete(
  '/:expenseId',
  ...guard,
  validate(expenseParamsDto, 'params'),
  asyncHandler(expenseController.deleteExpense),
);

export default router;
