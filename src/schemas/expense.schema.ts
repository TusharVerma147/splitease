import mongoose, { Document, Schema } from 'mongoose';
import { SplitType } from '../enum/enum';

export interface IExpenseSplit {
  userId: mongoose.Types.ObjectId;
  share: number;
}

export interface IExpense extends Document {
  groupId: mongoose.Types.ObjectId;
  description: string;
  amount: number;
  paidBy: mongoose.Types.ObjectId;
  splitType: SplitType;
  splits: IExpenseSplit[];
  expenseDate: Date;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    groupId: { type: Schema.Types.ObjectId, required: true, ref: 'Group' },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    paidBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    splitType: { type: String, enum: Object.values(SplitType), required: true },
    splits: [
      {
        userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
        share: { type: Number, required: true, min: 0 },
      },
    ],
    expenseDate: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

expenseSchema.index({ groupId: 1, expenseDate: -1 });
expenseSchema.index({ description: 'text' });

export const ExpenseModel = mongoose.model<IExpense>('Expense', expenseSchema);
