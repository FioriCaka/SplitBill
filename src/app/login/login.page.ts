import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
  selector: 'app-login',
  templateUrl: './login.page.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
  ],
})
export class LoginPage {
  email = '';
  password = '';
  errorMsg = '';
  private sb = inject(SplitBillService);
  private auth = inject(AuthService);
  private router = inject(Router);
  login() {
    if (!this.email.trim() || !this.password) return;
    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.errorMsg = '';
        // Sync local state with backend user
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
        console.error('Login failed', err);
        if (err?.status === 0) {
          // Status 0 typically means network unreachable / CORS preflight failed / server down
          this.errorMsg =
            'Cannot reach server. Verify API URL & that backend is running.';
        } else {
          this.errorMsg =
            err?.error?.message || 'Login failed. Check your credentials.';
        }
      },
    });
  }
}
