import { Component } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { SplitBillService } from '../core/splitbill.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
  ],
  templateUrl: './profile-page.html',
  styleUrls: ['./profile-page.scss'],
})
export class ProfilePage {
  constructor(private sb: SplitBillService, private router: Router) {}
  get user() {
    return this.sb.getUser();
  }
  logout() {
    this.sb.logout();
    this.router.navigateByUrl('/login');
  }
}
