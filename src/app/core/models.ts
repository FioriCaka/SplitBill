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
  paidBy: UUID; // user id
  splitWith: UUID[]; // participants sharing this expense
  createdAt: string; // ISO date
  groupId?: UUID; // optional group association
  // Advanced splitting
  splitMode?: 'equal' | 'percentage' | 'custom';
  splits?: Array<{
    participantId: UUID; // user id
    percentage?: number; // used when splitMode = 'percentage'
    amount?: number; // used when splitMode = 'custom'
  }>;
  // Optional metadata
  date?: string; // ISO date of the expense itself
  category?: string; // e.g., Food, Travel, Rent
  // Resolution status
  resolved?: boolean; // true when expense has been settled/cleared
  resolvedAt?: string; // ISO timestamp when marked resolved
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
  startingBalance?: number;
  imageUrl?: string;
  createdAt: string;
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
