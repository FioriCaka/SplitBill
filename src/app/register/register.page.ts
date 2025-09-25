import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
} from '@ionic/angular/standalone';
import { SplitBillService } from '../core/splitbill.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
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
  errorMsg = '';
  private sb = inject(SplitBillService);
  private auth = inject(AuthService);
  private router = inject(Router);
  register() {
    if (
      !this.name.trim() ||
      !this.email.trim() ||
      !this.password ||
      this.password !== this.confirmPassword
    )
      return;
    this.auth.register(this.name, this.email, this.password).subscribe({
      next: (res) => {
        this.errorMsg = '';
        this.sb.setUser(
          res.user.id,
          res.user.name,
          res.user.email,
          res.user.starting_balance,
          (res.user as any).profile_image_url
        );
        this.router.navigateByUrl('/tabs/tab3');
      },
      error: (err) => {
        console.error('Register failed', err);
        this.errorMsg = err?.error?.message || 'Registration failed.';
      },
    });
  }
}
