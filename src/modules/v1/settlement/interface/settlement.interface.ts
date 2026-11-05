export interface SettlementView {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  /** paise */
  amount: number;
  note?: string;
  createdAt: Date;
}

export interface Payment {
  from: string;
  to: string;
  /** paise */
  amount: number;
}
