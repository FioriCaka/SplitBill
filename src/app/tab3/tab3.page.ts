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
  IonCheckbox,
} from '@ionic/angular/standalone';
import { SplitBillService } from '../core/splitbill.service';
import {
  BalanceLine,
  SettlementSuggestion,
  Participant,
  Expense,
} from '../core/models';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    IonCheckbox,
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
    this.allExpenses = this.sb.listExpenses();
    const selectedIds = this.selectedExpenseIds.filter((id) =>
      this.allExpenses.some((e) => e.id === id)
    );
    if (selectedIds.length) {
      this.balances = this.sb.balancesFor(selectedIds);
      this.settlements = this.sb.settlementFor(selectedIds);
    } else {
      this.balances = this.sb.balances();
      this.settlements = this.sb.settlement();
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
}
