import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonButton,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { SplitBillService } from '../core/splitbill.service';
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
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonList,
    IonButton,
    IonSelect,
    IonSelectOption,
  ],
})
export class Tab3Page {
  balances: BalanceLine[] = [];
  settlements: SettlementSuggestion[] = [];
  participants: Record<string, Participant | undefined> = {};
  allExpenses: Expense[] = [];
  selectedExpenseIds: string[] = [];
  groups: Group[] = [];
  selectedGroupId: string | '' = '';
  invites: Invite[] = [];

  constructor(private sb: SplitBillService) {
    this.refresh();
  }

  private mapParticipants() {
    this.participants = Object.fromEntries(
      this.sb.listParticipants().map((p) => [p.id, p])
    );
  }

  refresh() {
    this.mapParticipants();
    this.groups = this.sb.listGroupsForCurrentUser();
    this.invites = this.sb.listPendingInvitesForCurrentUser();
    const base = this.selectedGroupId
      ? this.sb.listExpensesForGroup(this.selectedGroupId)
      : this.sb.listExpenses();
    this.allExpenses = base;
    const selectedIds = this.selectedExpenseIds.filter((id) =>
      base.some((e) => e.id === id)
    );
    if (selectedIds.length) {
      this.balances = this.sb.balancesFor(selectedIds);
      this.settlements = this.sb.settlementFor(selectedIds);
    } else {
      const allIds = base.map((e) => e.id);
      this.balances = this.sb.balancesFor(allIds);
      this.settlements = this.sb.settlementFor(allIds);
    }
  }

  nameOf(id: string): string {
    const p = this.participants[id];
    return p ? p.name : 'Unknown';
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
}
