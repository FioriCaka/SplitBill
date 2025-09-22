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
import { Expense, Participant, UUID } from '../core/models';

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
    this.expenses = this.sb.listExpenses();
    if (!this.paidBy && this.participants.length)
      this.paidBy = this.participants[0].id;
  }

  ionViewWillEnter() {
    this.refresh();
  }

  toggleShare(id: string, checked: boolean) {
    this.splitWith[id] = checked;
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
