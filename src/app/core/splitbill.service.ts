import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BackendApiService } from './backend.service';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';
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
  private api = inject(BackendApiService);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private authHeader(): HttpHeaders {
    const token = this.auth.token;
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }
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

  // Replace a participant id everywhere it appears across state
  private rekeyParticipantId(oldId: UUID, newId: UUID) {
    if (oldId === newId) return;
    // Participant record
    const p = this.state.participants.find((pp) => pp.id === oldId);
    if (p) p.id = newId;
    // Expenses: payer, splitWith array, splits entries
    for (const e of this.state.expenses) {
      if (e.paidBy === oldId) e.paidBy = newId;
      if (Array.isArray(e.splitWith)) {
        e.splitWith = e.splitWith.map((sid) => (sid === oldId ? newId : sid));
        // de-duplicate if any
        e.splitWith = Array.from(new Set(e.splitWith));
      }
      if (Array.isArray(e.splits)) {
        for (const s of e.splits) {
          if (s.participantId === oldId) s.participantId = newId;
        }
      }
    }
    // Groups: memberIds
    for (const g of this.state.groups || []) {
      if (!Array.isArray(g.memberIds)) continue;
      g.memberIds = g.memberIds.map((sid) => (sid === oldId ? newId : sid));
      g.memberIds = Array.from(new Set(g.memberIds));
    }
    // Invites: invitedByParticipantId (if used locally)
    for (const inv of this.state.invites || []) {
      if ((inv as any).invitedByParticipantId === oldId)
        (inv as any).invitedByParticipantId = newId;
    }
    this.save();
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.state = JSON.parse(raw);
        // Normalize collections in case of older saved state without new fields
        if (!this.state.participants) this.state.participants = [];
        if (!this.state.expenses) this.state.expenses = [];
        if (!this.state.groups) this.state.groups = [];
        if (!this.state.invites) this.state.invites = [];
        // Ensure createdAt exists on entities that require it
        const now = new Date().toISOString();
        for (const e of this.state.expenses) {
          if (!(e as any).createdAt) (e as any).createdAt = now;
        }
        for (const g of this.state.groups) {
          if (!(g as any).createdAt) (g as any).createdAt = now;
        }
        for (const i of this.state.invites) {
          if (!(i as any).createdAt) (i as any).createdAt = now;
        }
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
        if (this.currentUser && !(this.currentUser as any).createdAt) {
          (this.currentUser as any).createdAt = new Date().toISOString();
          localStorage.setItem(
            STORAGE_KEY + ':user',
            JSON.stringify(this.currentUser)
          );
        }
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
  // Set user from backend auth (preferred)
  setUser(
    id: string,
    name: string,
    email: string,
    startingBalance?: number,
    imageUrl?: string
  ) {
    const newId = id as UUID;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const now = new Date().toISOString();
    this.currentUser = {
      id: newId,
      name: trimmedName,
      email: trimmedEmail,
      startingBalance:
        typeof startingBalance === 'number'
          ? +startingBalance
          : this.currentUser?.startingBalance,
      imageUrl: imageUrl ?? this.currentUser?.imageUrl,
      createdAt: (this.currentUser as any)?.createdAt || now,
    } as User;
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
        id: newId,
        name: this.currentUser!.name,
        email: this.currentUser!.email,
      };
      this.state.participants.push(p);
      this.save();
    } else {
      // If participant exists but has a different id, migrate references
      if (p.id !== newId) this.rekeyParticipantId(p.id, newId);
      p.id = newId;
      p.name = this.currentUser!.name;
      p.email = this.currentUser!.email;
      this.save();
    }
    return this.currentUser;
  }
  setUserImage(url: string) {
    if (!this.currentUser) return;
    this.currentUser.imageUrl = url;
    localStorage.setItem(
      STORAGE_KEY + ':user',
      JSON.stringify(this.currentUser)
    );
  }
  login(name: string, email: string) {
    this.currentUser = {
      id: uuid(),
      name: name.trim(),
      email: email.trim(),
      createdAt: new Date().toISOString(),
    } as User;
    const u = this.currentUser;
    localStorage.setItem(STORAGE_KEY + ':user', JSON.stringify(u));
    const lower = u.email.toLowerCase();
    let p = this.state.participants.find(
      (pp) => (pp.email || '').toLowerCase() === lower
    );
    if (!p) {
      p = {
        id: uuid(),
        name: u.name,
        email: u.email,
      };
      this.state.participants.push(p);
      this.save();
    }
    return u;
  }
  logout() {
    this.currentUser = null;
    localStorage.removeItem(STORAGE_KEY + ':user');
  }

  updateUser(name: string, email: string) {
    if (!this.currentUser) return;
    const prevEmail = this.currentUser.email;
    this.currentUser.name = name.trim();
    this.currentUser.email = email.trim();
    localStorage.setItem(
      STORAGE_KEY + ':user',
      JSON.stringify(this.currentUser)
    );
    const p =
      this.getParticipantByEmail(prevEmail) ||
      this.getParticipantByEmail(this.currentUser.email);
    if (p) {
      p.name = this.currentUser.name;
      p.email = this.currentUser.email;
    } else {
      this.state.participants.push({
        id: uuid(),
        name: this.currentUser.name,
        email: this.currentUser.email,
      });
    }
    this.save();
  }

  getStartingBalance(): number {
    return this.currentUser?.startingBalance || 0;
  }

  setStartingBalance(amount: number) {
    if (!this.currentUser) return;
    this.currentUser.startingBalance = +amount;
    localStorage.setItem(
      STORAGE_KEY + ':user',
      JSON.stringify(this.currentUser)
    );
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
        splits: (e.splits || []).filter((s) => s.participantId !== id),
      }));
    this.save();
  }

  // Expenses
  listExpenses(includeResolved = true) {
    return includeResolved
      ? [...this.state.expenses]
      : this.state.expenses.filter((e) => !e.resolved);
  }
  addExpense(e: Omit<Expense, 'id' | 'createdAt'>) {
    const ex: Expense = {
      ...e,
      id: uuid(),
      createdAt: new Date().toISOString(),
      // Local-only marker so we avoid hitting backend resolve/unresolve until syncing implemented
      // @ts-ignore
      _localOnly: true,
    };
    this.state.expenses.push(ex);
    this.save();
    // Attempt immediate backend sync if authenticated
    try {
      const base = this.auth?.apiBaseUrl;
      const token = this.auth?.token;
      if (base && token) {
        const payload: any = {
          client_id: ex.id,
          description: ex.description,
          amount: ex.amount,
          group_id: (ex as any).groupId || ex.groupId || undefined,
          date: (ex as any).date,
          category: (ex as any).category,
          split_mode: (ex as any).splitMode || ex.splitMode,
        };
        // Attempt to include participants & splits only if they look like backend user IDs (numeric) – otherwise backend will reject.
        try {
          const participantUserIds: any[] = [];
          const paidByNumeric = Number.isFinite(+ex.paidBy)
            ? +ex.paidBy
            : undefined;
          if (paidByNumeric) payload.paid_by_user_id = paidByNumeric;
          // Collect unique participant ids from splitWith or splits
          const candidateIds = new Set<string>();
          (ex.splitWith || []).forEach((id) => candidateIds.add(id));
          (ex.splits || []).forEach((s) => candidateIds.add(s.participantId));
          for (const cid of candidateIds) {
            if (Number.isFinite(+cid)) participantUserIds.push(+cid);
          }
          if (participantUserIds.length)
            payload.participant_user_ids = participantUserIds;
          if (ex.splits && ex.splits.length) {
            const splitsPayload: any[] = [];
            for (const s of ex.splits) {
              if (!Number.isFinite(+s.participantId)) continue; // skip local-only participant ids
              const row: any = { participant_user_id: +s.participantId };
              if (typeof s.percentage === 'number')
                row.percentage = s.percentage;
              if (typeof s.amount === 'number') row.amount = s.amount;
              splitsPayload.push(row);
            }
            if (splitsPayload.length) payload.splits = splitsPayload;
          }
        } catch {}
        this.http
          ?.post(`${base}/expenses`, payload, { headers: this.authHeader() })
          .subscribe({
            next: () => {
              // Mark as synced
              (ex as any)._localOnly = false;
            },
            error: () => {
              // Leave as local; could enqueue retry later
            },
          });
      }
    } catch {}
    return ex;
  }

  private trySyncExpense(e: Expense) {
    try {
      if (!(e as any)._localOnly) return; // already synced
      const base = this.auth?.apiBaseUrl;
      const token = this.auth?.token;
      if (!base || !token) return;
      const payload: any = {
        client_id: e.id,
        description: e.description,
        amount: e.amount,
        group_id: (e as any).groupId || e.groupId || undefined,
        date: (e as any).date,
        category: (e as any).category,
        split_mode: (e as any).splitMode || e.splitMode,
      };
      try {
        const participantUserIds: any[] = [];
        if (Number.isFinite(+e.paidBy)) payload.paid_by_user_id = +e.paidBy;
        const candidateIds = new Set<string>();
        (e.splitWith || []).forEach((id) => candidateIds.add(id));
        (e.splits || []).forEach((s) => candidateIds.add(s.participantId));
        for (const cid of candidateIds) {
          if (Number.isFinite(+cid)) participantUserIds.push(+cid);
        }
        if (participantUserIds.length)
          payload.participant_user_ids = participantUserIds;
        if (e.splits && e.splits.length) {
          const splitsPayload: any[] = [];
          for (const s of e.splits) {
            if (!Number.isFinite(+s.participantId)) continue;
            const row: any = { participant_user_id: +s.participantId };
            if (typeof s.percentage === 'number') row.percentage = s.percentage;
            if (typeof s.amount === 'number') row.amount = s.amount;
            splitsPayload.push(row);
          }
          if (splitsPayload.length) payload.splits = splitsPayload;
        }
      } catch {}
      this.http
        ?.post(`${base}/expenses`, payload, { headers: this.authHeader() })
        .subscribe({
          next: () => {
            (e as any)._localOnly = false;
          },
          error: () => {
            // swallow
          },
        });
    } catch {}
  }
  removeExpense(id: UUID) {
    this.state.expenses = this.state.expenses.filter((e) => e.id !== id);
    this.save();
  }
  resolveExpense(id: UUID) {
    const e = this.state.expenses.find((x) => x.id === id);
    if (e && !e.resolved) {
      // If local-only try to sync first then proceed
      if ((e as any)._localOnly) {
        this.trySyncExpense(e);
      }
      e.resolved = true;
      e.resolvedAt = new Date().toISOString();
      this.save();
      // Attempt backend sync if token present AND expense previously synced (no _localOnly flag)
      try {
        const base = this.auth?.apiBaseUrl;
        const token = this.auth?.token;
        if (base && token && !(e as any)._localOnly) {
          this.http
            ?.patch(
              `${base}/expenses/${id}/resolve`,
              {},
              {
                headers: this.authHeader(),
              }
            )
            .subscribe({
              error: () => {
                /* ignore errors for now */
              },
            });
        }
      } catch {}
    }
  }
  unresolveExpense(id: UUID) {
    const e = this.state.expenses.find((x) => x.id === id);
    if (e && e.resolved) {
      if ((e as any)._localOnly) {
        this.trySyncExpense(e);
      }
      e.resolved = false;
      e.resolvedAt = undefined;
      this.save();
      try {
        const base = this.auth?.apiBaseUrl;
        const token = this.auth?.token;
        if (base && token && !(e as any)._localOnly) {
          this.http
            ?.patch(
              `${base}/expenses/${id}/unresolve`,
              {},
              {
                headers: this.authHeader(),
              }
            )
            .subscribe({
              error: () => {
                /* ignore */
              },
            });
        }
      } catch {}
    }
  }

  // Calculations
  private computeShares(
    e: Expense,
    allParticipants: Participant[]
  ): Map<UUID, number> {
    const shares = new Map<UUID, number>();
    const mode = e.splitMode || 'equal';
    if (mode === 'equal') {
      const sharers =
        e.splitWith.length > 0 ? e.splitWith : allParticipants.map((p) => p.id);
      const share = e.amount / (sharers.length || 1);
      for (const sid of sharers) shares.set(sid, share);
      return shares;
    }
    if (mode === 'percentage') {
      const list = (e.splits || []).filter(
        (s) => typeof s.percentage === 'number' && s.percentage! > 0
      );
      const totalPct = list.reduce((a, b) => a + (b.percentage || 0), 0);
      const norm = totalPct === 0 ? 1 : totalPct / 100;
      for (const s of list) {
        const owed = e.amount * ((s.percentage || 0) / (norm * 100));
        shares.set(s.participantId, owed);
      }
      return shares;
    }
    // custom amounts
    for (const s of e.splits || []) {
      if (typeof s.amount === 'number' && s.amount! > 0)
        shares.set(s.participantId, s.amount!);
    }
    return shares;
  }

  // Helper: share owed by a participant for a single expense
  shareOfParticipant(e: Expense, participantId: UUID): number {
    const shares = this.computeShares(e, this.state.participants);
    return +(shares.get(participantId) || 0);
  }
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
      if (!e.resolved) continue; // ONLY count resolved expenses in balances
      const payer = map.get(e.paidBy);
      if (payer) payer.paidTotal += e.amount;
      const shares = this.computeShares(e, this.state.participants);
      for (const [sid, owed] of shares) {
        const line = map.get(sid);
        if (line) line.owedTotal += owed;
      }
    }
    for (const line of map.values()) {
      line.net = +(line.paidTotal - line.owedTotal).toFixed(2);
    }
    return [...map.values()];
  }

  // Backend-backed balances for a group. Falls back to local calc if no group.
  async balancesForGroup(groupId?: UUID): Promise<BalanceLine[]> {
    if (!groupId) return this.balances();
    try {
      const rows = await firstValueFrom(this.api.getGroupBalances(groupId));
      const out: BalanceLine[] = [];
      for (const r of rows || []) {
        out.push({
          participantId: String(r.userId) as UUID,
          paidTotal: r.balance >= 0 ? r.balance : 0,
          owedTotal: r.balance < 0 ? -r.balance : 0,
          net: +r.balance,
        });
      }
      return out;
    } catch {
      return this.balances();
    }
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
    const expenses = this.state.expenses.filter(
      (e) => set.has(e.id) && e.resolved
    );
    for (const e of expenses) {
      const payer = map.get(e.paidBy);
      if (payer) payer.paidTotal += e.amount;
      const shares = this.computeShares(e, this.state.participants);
      for (const [sid, owed] of shares) {
        const line = map.get(sid);
        if (line) line.owedTotal += owed;
      }
    }
    for (const line of map.values())
      line.net = +(line.paidTotal - line.owedTotal).toFixed(2);
    return [...map.values()];
  }

  // Aggregated direct ledger of who owes whom (pre-settlement)
  ledger(): SettlementSuggestion[] {
    const pair = new Map<string, number>(); // key: from->to
    for (const e of this.state.expenses) {
      if (!e.resolved) continue; // ledger only from resolved expenses
      const shares = this.computeShares(e, this.state.participants);
      for (const [sid, owed] of shares) {
        if (sid === e.paidBy) continue;
        const key = `${sid}->${e.paidBy}`;
        pair.set(key, +((pair.get(key) || 0) + owed).toFixed(2));
      }
    }
    const res: SettlementSuggestion[] = [];
    for (const [k, amount] of pair) {
      const [from, to] = k.split('->') as [UUID, UUID];
      if (amount > 0.005) res.push({ from, to, amount: +amount.toFixed(2) });
    }
    return res;
  }

  // Group membership updates
  removeParticipantFromGroup(groupId: UUID, participantId: UUID) {
    const g = this.state.groups!.find((g) => g.id === groupId);
    if (!g) return;
    g.memberIds = g.memberIds.filter((id) => id !== participantId);
    this.save();
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
    if (!this.state.groups) this.state.groups = [];
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
    if (!this.state.invites) this.state.invites = [];
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
