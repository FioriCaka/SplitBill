import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
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
    IonHeader,
    IonToolbar,
    IonTitle,
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
  }

  addExpense() {
    const shareIds = Object.keys(this.splitWith).filter(
      (id) => this.splitWith[id]
    );
    const amt = parseFloat(this.amount);
    if (!this.description.trim() || !this.paidBy || !isFinite(amt) || amt <= 0)
      return;
    this.sb.addExpense({
      description: this.description.trim(),
      amount: +amt.toFixed(2),
      paidBy: this.paidBy as string,
      splitWith: shareIds,
      groupId: this.groupId || undefined,
    });
    this.description = '';
    this.amount = '';
    this.splitWith = {};
    this.refresh();
  }

  removeExpense(id: string) {
    this.sb.removeExpense(id);
    this.refresh();
  }
}
