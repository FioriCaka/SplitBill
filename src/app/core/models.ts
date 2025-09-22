export type UUID = string;

export interface Participant {
  id: UUID;
  name: string;
}

export interface Expense {
  id: UUID;
  description: string;
  amount: number; // in currency units
  paidBy: UUID; // participant id
  splitWith: UUID[]; // participants sharing this expense
  createdAt: string; // ISO date
}

export interface State {
  participants: Participant[];
  expenses: Expense[];
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
