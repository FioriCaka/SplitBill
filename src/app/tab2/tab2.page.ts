import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonInput,
  IonItem,
  IonList,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
} from '@ionic/angular/standalone';
import { SplitBillService } from '../core/splitbill.service';
import { Expense, Participant, UUID, Group } from '../core/models';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonButton,
    IonInput,
    IonItem,
    IonList,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonCheckbox,
  ],
})
export class Tab2Page {
  participants: Participant[] = [];
  availableParticipants: Participant[] = [];
  groups: Group[] = [];
  groupId: UUID | '' = '';
  expenses: Expense[] = [];
  description = '';
  amount: any = '';
  paidBy: UUID | '' = '';
  splitWith: Record<string, boolean> = {};
  splitMode: 'equal' | 'percentage' | 'custom' = 'equal';
  splitsInput: Record<string, number> = {};
  date: string = '';
  category: string = '';
  categories = [
    'General',
    'Food',
    'Travel',
    'Rent',
    'Utilities',
    'Groceries',
    'Entertainment',
    'Other',
  ];

  constructor(private sb: SplitBillService) {
    this.refresh();
  }

  refresh() {
    this.participants = this.sb.listParticipants();
    this.groups = this.sb.listGroupsForCurrentUser();
    this.expenses = this.groupId
      ? this.sb.listExpensesForGroup(this.groupId)
      : this.sb.listExpenses();
    this.recomputeAvailableParticipants();
    if (!this.paidBy && this.availableParticipants.length)
      this.paidBy = this.availableParticipants[0].id;
    if (!this.date) this.date = new Date().toISOString().slice(0, 10);
  }

  ionViewWillEnter() {
    this.refresh();
  }

  toggleShare(id: string, checked: boolean) {
    this.splitWith[id] = checked;
  }

  onSelectGroup(id: string) {
    this.groupId = id as UUID;
    this.refresh();
  }

  private recomputeAvailableParticipants() {
    if (this.groupId) {
      const g = this.groups.find((gg) => gg.id === this.groupId);
      const memberSet = new Set(g ? g.memberIds : []);
      this.availableParticipants = this.participants.filter((p) =>
        memberSet.has(p.id)
      );
    } else {
      this.availableParticipants = [...this.participants];
    }
    if (
      this.paidBy &&
      !this.availableParticipants.some((p) => p.id === this.paidBy)
    ) {
      this.paidBy = this.availableParticipants[0]?.id || '';
    }
    const allowed = new Set(this.availableParticipants.map((p) => p.id));
    for (const key of Object.keys(this.splitWith)) {
      if (!allowed.has(key)) delete this.splitWith[key];
    }
    for (const key of Object.keys(this.splitsInput)) {
      if (!allowed.has(key)) delete this.splitsInput[key];
    }
  }

  addExpense() {
    const shareIds = Object.keys(this.splitWith).filter(
      (id) => this.splitWith[id]
    );
    const amt = parseFloat(this.amount);
    if (!this.description.trim() || !this.paidBy || !isFinite(amt) || amt <= 0)
      return;
    const payload: any = {
      description: this.description.trim(),
      amount: +amt.toFixed(2),
      paidBy: this.paidBy as string,
      splitWith: shareIds,
      groupId: this.groupId || undefined,
      splitMode: this.splitMode,
      category: this.category || undefined,
      date: this.date || new Date().toISOString().slice(0, 10),
    };
    if (this.splitMode === 'percentage') {
      const splits = shareIds.map((id) => ({
        participantId: id,
        percentage: +(this.splitsInput[id] || 0),
      }));
      payload.splits = splits;
    } else if (this.splitMode === 'custom') {
      const splits = shareIds.map((id) => ({
        participantId: id,
        amount: +parseFloat(String(this.splitsInput[id] || 0)).toFixed(2),
      }));
      payload.splits = splits;
    }
    this.sb.addExpense(payload);
    this.description = '';
    this.amount = '';
    this.splitWith = {};
    this.splitsInput = {};
    this.splitMode = 'equal';
    this.date = new Date().toISOString().slice(0, 10);
    this.category = '';
    this.refresh();
  }

  removeExpense(id: string) {
    this.sb.removeExpense(id);
    this.refresh();
  }

  get addDisabled(): boolean {
    const amt = parseFloat(this.amount);
    if (!this.description.trim() || !this.paidBy || !isFinite(amt) || amt <= 0)
      return true;
    const shareIds = Object.keys(this.splitWith).filter(
      (id) => this.splitWith[id]
    );
    if (this.splitMode === 'equal') return false;
    if (this.splitMode === 'percentage') {
      if (shareIds.length === 0) return true;
      const total = shareIds.reduce(
        (a, id) => a + (parseFloat(String(this.splitsInput[id])) || 0),
        0
      );
      return Math.abs(total - 100) > 0.01;
    }
    if (this.splitMode === 'custom') {
      if (shareIds.length === 0) return true;
      const total = shareIds.reduce(
        (a, id) => a + (parseFloat(String(this.splitsInput[id])) || 0),
        0
      );
      return Math.abs(total - parseFloat(this.amount)) > 0.01;
    }
    return false;
  }
}
