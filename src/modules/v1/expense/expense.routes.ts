import { Router } from 'express';
import { expenseController } from './expense.controller';
import { accessTokenMiddleware } from '../../../middlewares/accessToken.middleware';
import { groupMemberMiddleware } from '../../../middlewares/groupMember.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { createExpenseDto, updateExpenseDto } from './dto/expense.dto';

const router = Router({ mergeParams: true });

router.post('/', accessTokenMiddleware, groupMemberMiddleware, validate(createExpenseDto), (req, res) => { void expenseController.addExpense(req, res); });
router.get('/', accessTokenMiddleware, groupMemberMiddleware, (req, res) => { void expenseController.listExpenses(req, res); });
router.get('/:expenseId', accessTokenMiddleware, groupMemberMiddleware, (req, res) => { void expenseController.getExpense(req, res); });
router.patch('/:expenseId', accessTokenMiddleware, groupMemberMiddleware, validate(updateExpenseDto), (req, res) => { void expenseController.updateExpense(req, res); });
router.delete('/:expenseId', accessTokenMiddleware, groupMemberMiddleware, (req, res) => { void expenseController.deleteExpense(req, res); });

export default router;
