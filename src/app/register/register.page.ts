import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
} from '@ionic/angular/standalone';
import { SplitBillService } from '../core/splitbill.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
  ],
})
export class RegisterPage {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  constructor(private sb: SplitBillService, private router: Router) {}
  register() {
    if (
      !this.name.trim() ||
      !this.email.trim() ||
      !this.password ||
      this.password !== this.confirmPassword
    )
      return;
    this.sb.login(this.name, this.email);
    this.router.navigateByUrl('/tabs/tab3');
  }
}
