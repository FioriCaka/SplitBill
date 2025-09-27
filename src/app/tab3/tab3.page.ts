import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonAccordionGroup,
  IonAccordion,
} from '@ionic/angular/standalone';
import { SplitBillService } from '../core/splitbill.service';
import { BackendApiService } from '../core/backend.service';
import {
  BalanceLine,
  SettlementSuggestion,
  Participant,
  Expense,
  Group,
  Invite,
} from '../core/models';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonItem,
    IonLabel,
    IonList,
    IonButton,
    IonSelect,
    IonSelectOption,
    IonAccordionGroup,
    IonAccordion,
  ],
})
export class Tab3Page {
  balances: BalanceLine[] = [];
  settlements: SettlementSuggestion[] = [];
  participants: Record<string, Participant | undefined> = {};
  allExpenses: Expense[] = [];
  unresolvedExpenses: Expense[] = [];
  selectedExpenseIds: string[] = [];
  groups: Group[] = [];
  selectedGroupId: string | '' = '';
  invites: Invite[] = [];
  userName = '';
  private nameById: Record<string, string> = {};
  recent: Array<{
    id: string;
    description: string;
    amount: number;
    createdAt: string;
    category?: string;
    groupName?: string;
  }> = [];
  private sb = inject(SplitBillService);
  private api = inject(BackendApiService);
  // Toggle between personal vs everyone totals
  showEveryone = false;

  constructor() {
    this.refresh();
  }

  private mapParticipants() {
    this.participants = Object.fromEntries(
      this.sb.listParticipants().map((p) => [p.id, p])
    );
  }

  refresh() {
    this.mapParticipants();
    const u = this.sb.getUser();
    this.userName = u?.name || 'there';
    this.groups = this.sb.listGroupsForCurrentUser();
    this.invites = this.sb.listPendingInvitesForCurrentUser();
    const baseRaw = this.selectedGroupId
      ? this.sb.listExpensesForGroup(this.selectedGroupId)
      : this.sb.listExpenses();
    // Only resolved expenses contribute to balances now
    const resolved = baseRaw.filter((e) => e.resolved);
    const unresolved = baseRaw.filter((e) => !e.resolved);
    this.allExpenses = resolved;
    this.unresolvedExpenses = unresolved;
    const groupsById = Object.fromEntries(
      this.sb.listGroups().map((g) => [g.id, g])
    );
    this.recent = [...resolved]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        createdAt: e.createdAt,
        category: e.category,
        groupName: e.groupId ? groupsById[e.groupId!]?.name : undefined,
      }));
    const selectedIds = this.selectedExpenseIds.filter((id) =>
      resolved.some((e) => e.id === id)
    );
    if (selectedIds.length) {
      this.balances = this.sb.balancesFor(selectedIds);
      this.settlements = this.sb.settlementFor(selectedIds);
    } else if (this.selectedGroupId) {
      // Only call backend if the selectedGroupId matches an existing local group id
      const valid = this.groups.some((g) => g.id === this.selectedGroupId);
      if (valid) {
        this.api.getGroupBalances(this.selectedGroupId).subscribe({
          next: (rows) => {
            this.nameById = Object.fromEntries(
              rows.map((r) => [r.userId, r.name])
            );
            this.balances = rows.map((r) => ({
              participantId: r.userId,
              paidTotal: r.balance >= 0 ? r.balance : 0,
              owedTotal: r.balance < 0 ? -r.balance : 0,
              net: +r.balance,
            }));
            this.settlements = [];
          },
          error: () => {
            // Fallback to local calc if backend 404s
            const allIds = resolved.map((e) => e.id);
            this.balances = this.sb.balancesFor(allIds);
            this.settlements = this.sb.settlementFor(allIds);
          },
        });
      } else {
        const allIds = resolved.map((e) => e.id);
        this.balances = this.sb.balancesFor(allIds);
        this.settlements = this.sb.settlementFor(allIds);
      }
    } else {
      const allIds = resolved.map((e) => e.id);
      this.balances = this.sb.balancesFor(allIds);
      this.settlements = this.sb.settlementFor(allIds);
    }
  }

  nameOf(id: string): string {
    const p = this.participants[id];
    return p?.name || this.nameById[id] || 'Unknown';
  }

  ionViewWillEnter() {
    this.refresh();
  }

  onSelectChange(ids: string[] | undefined) {
    this.selectedExpenseIds = Array.isArray(ids) ? ids : [];
    this.refresh();
  }

  onSelectGroup(id: string | undefined) {
    this.selectedGroupId = id || '';
    this.selectedExpenseIds = [];
    this.refresh();
  }

  acceptInvite(inv: Invite) {
    const p = this.sb.getCurrentParticipant();
    if (!p) return;
    this.sb.respondInvite(inv.id, true, p.id);
    this.refresh();
  }

  declineInvite(inv: Invite) {
    this.sb.respondInvite(inv.id, false);
    this.refresh();
  }

  get totalPaid() {
    return this.balances.reduce((a, b) => a + b.paidTotal, 0);
  }
  get totalOwed() {
    return this.balances.reduce((a, b) => a + b.owedTotal, 0);
  }
  get netAll() {
    return +(this.totalPaid - this.totalOwed).toFixed(2);
  }

  // User-centric totals (what the CURRENT user personally paid vs owes)
  private currentUserId(): string | null {
    return this.sb.getUser()?.id || null;
  }
  private expensesForTotals(): Expense[] {
    // If user selected a subset of expenses, mirror that context; else use all resolved in scope
    if (this.selectedExpenseIds.length) {
      const set = new Set(this.selectedExpenseIds);
      return this.allExpenses.filter((e) => set.has(e.id));
    }
    return this.allExpenses;
  }
  get userPaid() {
    const uid = this.currentUserId();
    if (!uid) return 0;
    const expenses = this.expensesForTotals();
    const total = expenses
      .filter((e) => e.paidBy === uid)
      .reduce((a, b) => a + b.amount, 0);
    return +total.toFixed(2);
  }
  get userOwed() {
    const uid = this.currentUserId();
    if (!uid) return 0;
    const expenses = this.expensesForTotals();
    let sum = 0;
    for (const e of expenses) {
      sum += this.sb.shareOfParticipant(e, uid as any) || 0;
    }
    return +sum.toFixed(2);
  }
  get userNet() {
    return +(this.userPaid - this.userOwed).toFixed(2);
  }

  // Unified getters for template depending on toggle
  get displayPaid() {
    return this.showEveryone ? this.totalPaid : this.userPaid;
  }
  get displayOwed() {
    if (!this.showEveryone) return this.userOwed;
    const uid = this.currentUserId();
    if (!uid) return this.totalOwed; // no user context, fall back
    // Sum owed totals for everyone EXCEPT the current user
    return this.balances
      .filter((b) => b.participantId !== uid)
      .reduce((a, b) => a + b.owedTotal, 0);
  }
  get displayNet() {
    return this.showEveryone ? this.netAll : this.userNet;
  }
  get displayPaidLabel() {
    return this.showEveryone ? 'Everyone paid' : 'You paid';
  }
  get displayOwedLabel() {
    return this.showEveryone ? 'Everyone owes' : 'You owe';
  }
  get displayNetLabel() {
    return this.showEveryone ? 'Group net (should be 0)' : 'Your net';
  }
  toggleTotalsMode() {
    this.showEveryone = !this.showEveryone;
  }

  // Determine if toggle should be shown (need more than 1 distinct participant in scope)
  get canToggleTotals() {
    const expenses = this.expensesForTotals();
    const set = new Set<string>();
    for (const e of expenses) {
      set.add(e.paidBy);
      if (e.splitWith) for (const sid of e.splitWith) set.add(sid);
      if (e.splits) for (const s of e.splits) set.add(s.participantId);
    }
    return set.size > 1; // only meaningful if more than one participant
  }
}
