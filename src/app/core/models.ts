export type UUID = string;

export interface Participant {
  id: UUID;
  name: string;
  email?: string;
}

export interface Expense {
  id: UUID;
  description: string;
  amount: number; // in currency units
  paidBy: UUID; // participant id
  splitWith: UUID[]; // participants sharing this expense
  createdAt: string; // ISO date
  groupId?: UUID; // optional group association
}

export interface State {
  participants: Participant[];
  expenses: Expense[];
  groups?: Group[];
  invites?: Invite[];
}

export interface BalanceLine {
  participantId: UUID;
  paidTotal: number;
  owedTotal: number;
  net: number; // positive means they should receive
}

export interface SettlementSuggestion {
  from: UUID;
  to: UUID;
  amount: number;
}

export interface User {
  id: UUID;
  name: string;
  email: string;
}

export interface Group {
  id: UUID;
  name: string;
  memberIds: UUID[]; // participant ids
  createdAt: string;
}

export type InviteStatus = 'pending' | 'accepted' | 'declined';
export interface Invite {
  id: UUID;
  email: string; // invite target email
  groupId: UUID;
  invitedByParticipantId: UUID;
  status: InviteStatus;
  createdAt: string;
}
