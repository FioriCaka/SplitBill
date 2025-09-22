import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
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
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { SplitBillService } from '../core/splitbill.service';
import { Participant } from '../core/models';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonInput,
    IonItem,
    IonList,
    IonLabel,
    FormsModule,
  ],
})
export class Tab1Page {
  name = '';
  participants: Participant[] = [];

  constructor(private sb: SplitBillService) {
    this.refresh();
  }

  refresh() {
    this.participants = this.sb.listParticipants();
  }
  add() {
    if (this.name.trim()) {
      this.sb.addParticipant(this.name);
      this.name = '';
      this.refresh();
    }
  }
  remove(id: string) {
    this.sb.removeParticipant(id);
    this.refresh();
  }

  ionViewWillEnter() {
    this.refresh();
  }
}
