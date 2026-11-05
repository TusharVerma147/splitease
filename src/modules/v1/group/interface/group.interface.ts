export interface GroupMemberView {
  userId: string;
  name: string;
  email: string;
  joinedAt: Date;
}

export interface GroupView {
  id: string;
  name: string;
  createdBy: string;
  isArchived: boolean;
  members: GroupMemberView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupListItem {
  id: string;
  name: string;
  memberCount: number;
  /** My net balance in this group, in paise (positive: I am owed, negative: I owe). */
  myBalance: number;
  stale: boolean;
  createdAt: Date;
  updatedAt: Date;
}
