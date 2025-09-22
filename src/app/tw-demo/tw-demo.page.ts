import { Component } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-tw-demo',
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButton],
  templateUrl: './tw-demo.page.html',
  styleUrls: ['./tw-demo.page.scss'],
})
export class TwDemoPage {}
