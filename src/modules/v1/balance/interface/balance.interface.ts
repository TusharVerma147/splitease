export interface MemberBalance {
  userId: string;
  name: string;
  net: number;
}

export interface GroupBalanceResult {
  groupId: string;
  balances: MemberBalance[];
  stale: boolean;
}

export interface MyGroupBalance {
  groupId: string;
  groupName: string;
  net: number;
}

export interface MyBalancesResult {
  /** Sum of what you owe across groups (paise, positive number). */
  totalOwe: number;
  /** Sum of what you are owed across groups (paise, positive number). */
  totalOwed: number;
  /** totalOwed - totalOwe */
  net: number;
  groups: MyGroupBalance[];
}
