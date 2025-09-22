import { Injectable, inject } from '@angular/core';
import {
  State,
  Participant,
  Expense,
  UUID,
  BalanceLine,
  SettlementSuggestion,
  Group,
  Invite,
  User,
} from './models';

const STORAGE_KEY = 'splitbill:v1';

function uuid(): UUID {
  try {
    if (
      typeof crypto !== 'undefined' &&
      typeof (crypto as any).randomUUID === 'function'
    ) {
      return (crypto as any).randomUUID();
    }
  } catch {}
  let bytes: Uint8Array;
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    bytes = crypto.getRandomValues(new Uint8Array(16));
  } else {
    bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC4122
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'));
  return (`${hex[0]}${hex[1]}${hex[2]}${hex[3]}-` +
    `${hex[4]}${hex[5]}-` +
    `${hex[6]}${hex[7]}-` +
    `${hex[8]}${hex[9]}-` +
    `${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`) as UUID;
}

@Injectable({ providedIn: 'root' })
export class SplitBillService {
  private state: State = {
    participants: [],
    expenses: [],
    groups: [],
    invites: [],
  };
  private currentUser: User | null = null;

  constructor() {
    this.load();
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.state = JSON.parse(raw);
      } catch {
        this.state = {
          participants: [],
          expenses: [],
          groups: [],
          invites: [],
        };
      }
    }
    const uraw = localStorage.getItem(STORAGE_KEY + ':user');
    if (uraw)
      try {
        this.currentUser = JSON.parse(uraw);
      } catch {}
  }

  reset() {
    this.state = { participants: [], expenses: [], groups: [], invites: [] };
    this.save();
  }

  // Auth
  getUser() {
    return this.currentUser;
  }
  login(name: string, email: string) {
    this.currentUser = { id: uuid(), name: name.trim(), email: email.trim() };
    localStorage.setItem(
      STORAGE_KEY + ':user',
      JSON.stringify(this.currentUser)
    );
    const lower = this.currentUser.email.toLowerCase();
    let p = this.state.participants.find(
      (pp) => (pp.email || '').toLowerCase() === lower
    );
    if (!p) {
      p = {
        id: uuid(),
        name: this.currentUser.name,
        email: this.currentUser.email,
      };
      this.state.participants.push(p);
      this.save();
    }
    return this.currentUser;
  }
  logout() {
    this.currentUser = null;
    localStorage.removeItem(STORAGE_KEY + ':user');
  }

  getParticipantByEmail(email: string) {
    const e = email.trim().toLowerCase();
    return this.state.participants.find(
      (p) => (p.email || '').toLowerCase() === e
    );
  }
  getCurrentParticipant() {
    if (!this.currentUser) return undefined;
    return this.getParticipantByEmail(this.currentUser.email);
  }

  // Participants
  listParticipants() {
    return [...this.state.participants];
  }
  addParticipant(name: string, email?: string) {
    const p: Participant = {
      id: uuid(),
      name: name.trim(),
      email: email?.trim(),
    };
    this.state.participants.push(p);
    this.save();
    return p;
  }
  removeParticipant(id: UUID) {
    this.state.participants = this.state.participants.filter(
      (p) => p.id !== id
    );
    // Also remove them from splits and as payer
    this.state.expenses = this.state.expenses
      .filter((e) => e.paidBy !== id)
      .map((e) => ({
        ...e,
        splitWith: e.splitWith.filter((sid) => sid !== id),
      }));
    this.save();
  }

  // Expenses
  listExpenses() {
    return [...this.state.expenses];
  }
  addExpense(e: Omit<Expense, 'id' | 'createdAt'>) {
    const ex: Expense = {
      ...e,
      id: uuid(),
      createdAt: new Date().toISOString(),
    };
    this.state.expenses.push(ex);
    this.save();
    return ex;
  }
  removeExpense(id: UUID) {
    this.state.expenses = this.state.expenses.filter((e) => e.id !== id);
    this.save();
  }

  // Calculations
  balances(): BalanceLine[] {
    const map = new Map<UUID, BalanceLine>();
    for (const p of this.state.participants) {
      map.set(p.id, {
        participantId: p.id,
        paidTotal: 0,
        owedTotal: 0,
        net: 0,
      });
    }
    for (const e of this.state.expenses) {
      const sharers =
        e.splitWith.length > 0
          ? e.splitWith
          : this.state.participants.map((p) => p.id);
      const share = e.amount / sharers.length;
      const payer = map.get(e.paidBy);
      if (payer) payer.paidTotal += e.amount;
      for (const sid of sharers) {
        const line = map.get(sid);
        if (line) line.owedTotal += share;
      }
    }
    for (const line of map.values()) {
      line.net = +(line.paidTotal - line.owedTotal).toFixed(2);
    }
    return [...map.values()];
  }

  // Greedy settlement: payers with negative net pay receivers with positive net
  settlement(): SettlementSuggestion[] {
    const pos: BalanceLine[] = [],
      neg: BalanceLine[] = [];
    for (const b of this.balances()) {
      if (b.net > 0.005) pos.push({ ...b });
      else if (b.net < -0.005) neg.push({ ...b });
    }
    pos.sort((a, b) => b.net - a.net);
    neg.sort((a, b) => a.net - b.net);
    const res: SettlementSuggestion[] = [];
    let i = 0,
      j = 0;
    while (i < pos.length && j < neg.length) {
      const take = Math.min(pos[i].net, -neg[j].net);
      res.push({
        from: neg[j].participantId,
        to: pos[i].participantId,
        amount: +take.toFixed(2),
      });
      pos[i].net = +(pos[i].net - take).toFixed(2);
      neg[j].net = +(neg[j].net + take).toFixed(2);
      if (pos[i].net <= 0.005) i++;
      if (neg[j].net >= -0.005) j++;
    }
    return res;
  }

  // Filtered calculations for selected expenses
  balancesFor(expenseIds: UUID[]): BalanceLine[] {
    const set = new Set(expenseIds);
    const map = new Map<UUID, BalanceLine>();
    for (const p of this.state.participants) {
      map.set(p.id, {
        participantId: p.id,
        paidTotal: 0,
        owedTotal: 0,
        net: 0,
      });
    }
    const expenses = this.state.expenses.filter((e) => set.has(e.id));
    for (const e of expenses) {
      const sharers =
        e.splitWith.length > 0
          ? e.splitWith
          : this.state.participants.map((p) => p.id);
      const share = e.amount / sharers.length;
      const payer = map.get(e.paidBy);
      if (payer) payer.paidTotal += e.amount;
      for (const sid of sharers) {
        const line = map.get(sid);
        if (line) line.owedTotal += share;
      }
    }
    for (const line of map.values())
      line.net = +(line.paidTotal - line.owedTotal).toFixed(2);
    return [...map.values()];
  }

  settlementFor(expenseIds: UUID[]): SettlementSuggestion[] {
    const balances = this.balancesFor(expenseIds);
    const pos: BalanceLine[] = [],
      neg: BalanceLine[] = [];
    for (const b of balances) {
      if (b.net > 0.005) pos.push({ ...b });
      else if (b.net < -0.005) neg.push({ ...b });
    }
    pos.sort((a, b) => b.net - a.net);
    neg.sort((a, b) => a.net - b.net);
    const res: SettlementSuggestion[] = [];
    let i = 0,
      j = 0;
    while (i < pos.length && j < neg.length) {
      const take = Math.min(pos[i].net, -neg[j].net);
      res.push({
        from: neg[j].participantId,
        to: pos[i].participantId,
        amount: +take.toFixed(2),
      });
      pos[i].net = +(pos[i].net - take).toFixed(2);
      neg[j].net = +(neg[j].net + take).toFixed(2);
      if (pos[i].net <= 0.005) i++;
      if (neg[j].net >= -0.005) j++;
    }
    return res;
  }

  // Groups
  listGroups(): Group[] {
    return [...(this.state.groups || [])];
  }
  listGroupsForParticipant(participantId: UUID): Group[] {
    return this.listGroups().filter((g) => g.memberIds.includes(participantId));
  }
  listGroupsForCurrentUser(): Group[] {
    const p = this.getCurrentParticipant();
    return p ? this.listGroupsForParticipant(p.id) : [];
  }
  addGroup(name: string, memberIds: UUID[]) {
    const g: Group = {
      id: uuid(),
      name: name.trim(),
      memberIds: [...new Set(memberIds)],
      createdAt: new Date().toISOString(),
    };
    this.state.groups!.push(g);
    this.save();
    return g;
  }
  addParticipantToGroup(groupId: UUID, participantId: UUID) {
    const g = this.state.groups!.find((g) => g.id === groupId);
    if (!g) return;
    if (!g.memberIds.includes(participantId)) g.memberIds.push(participantId);
    this.save();
  }

  // Invites
  listInvites(): Invite[] {
    return [...(this.state.invites || [])];
  }
  listPendingInvitesForCurrentUser(): Invite[] {
    const u = this.getUser();
    if (!u) return [];
    const lower = u.email.toLowerCase();
    return this.listInvites().filter(
      (i) => i.status === 'pending' && i.email.toLowerCase() === lower
    );
  }
  inviteToGroup(
    groupId: UUID,
    invitedEmail: string,
    invitedByParticipantId: UUID
  ) {
    const inv: Invite = {
      id: uuid(),
      groupId,
      email: invitedEmail.trim(),
      invitedByParticipantId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.state.invites!.push(inv);
    this.save();
    return inv;
  }
  respondInvite(inviteId: UUID, accept: boolean, participantId?: UUID) {
    const inv = this.state.invites!.find((i) => i.id === inviteId);
    if (!inv) return;
    inv.status = accept ? 'accepted' : 'declined';
    if (accept && participantId)
      this.addParticipantToGroup(inv.groupId, participantId);
    this.save();
  }

  // Group-scoped expenses
  listExpensesForGroup(groupId: UUID): Expense[] {
    return this.state.expenses.filter((e) => e.groupId === groupId);
  }
}
