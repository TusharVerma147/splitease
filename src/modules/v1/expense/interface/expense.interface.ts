import { SplitType } from '../../../../enum/enum';

export interface ExpenseSplitView {
  userId: string;
  /** paise, always - even for PERCENT expenses */
  share: number;
}

export interface ExpenseView {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  splits: ExpenseSplitView[];
  expenseDate: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
