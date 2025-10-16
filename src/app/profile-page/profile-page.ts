import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
} from '@angular/core';
import {
  IonContent,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonModal,
  IonAccordion,
  IonAccordionGroup,
  IonIcon,
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SplitBillService } from '../core/splitbill.service';
import { BackendApiService } from '../core/backend.service';
import { AuthService } from '../core/auth.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { createOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonButton,
    IonItem,
    IonLabel,
    IonInput,
    IonModal,
    IonAccordion,
    IonAccordionGroup,
    IonIcon,
  ],
  templateUrl: './profile-page.html',
  styleUrls: ['./profile-page.scss'],
})
export class ProfilePage implements AfterViewInit, OnDestroy {
  name = '';
  password = '';
  email = '';
  createdAt = '';
  private imageBase64: string | null = null;
  startingBalance = 0;
  currentBalance = 0;
  unresolvedCount = 0; // number of unresolved expenses not yet reflected
  balanceModalOpen = false;
  startingBalanceInput: any = '';
  @ViewChild('balanceChart', { static: false })
  balanceChartRef?: ElementRef<HTMLCanvasElement>;
  private balanceChart?: any;

  private sb = inject(SplitBillService);
  private router = inject(Router);
  private api = inject(BackendApiService);
  private auth = inject(AuthService);
  get user() {
    return this.sb.getUser();
  }
  constructor() {
    addIcons({ createOutline, eyeOutline, eyeOffOutline });
  }
  async ionViewWillEnter() {
    const u = this.sb.getUser();
    this.name = u?.name || '';
    this.password = '';
    this.email = u?.email || '';
    this.createdAt = u?.createdAt
      ? new Date(u.createdAt).toLocaleDateString()
      : '';
    try {
      const { firstValueFrom } = await import('rxjs');
      const me = await firstValueFrom(this.auth.me());
      this.sb.setUser(
        me.id,
        me.name,
        me.email,
        (me as any).starting_balance,
        (me as any).profile_image_url || undefined
      );
      const createdAt = (me as any).created_at || (me as any).createdAt || null;
      this.createdAt = createdAt
        ? new Date(createdAt).toLocaleDateString()
        : '';
    } catch {}
    this.startingBalance = this.sb.getStartingBalance();
    this.startingBalanceInput = this.startingBalance;
    if (this.balanceChartRef) this.updateChart();
  }
  async save() {
    const name = (this.name || '').trim();
    const email = (this.email || '').trim();
    const password = (this.password || '').trim();
    if (!name || !email) return;
    try {
      const payload: any = { name, email };
      if (password) payload.password = password;
      if (this.imageBase64) payload.profile_image_base64 = this.imageBase64;
      const { firstValueFrom } = await import('rxjs');
      const resp: any = await firstValueFrom(this.api.updateProfile(payload));
      this.sb.updateUser(resp?.user?.name || name, resp?.user?.email || email);
      if (resp?.user?.profile_image_url)
        this.sb.setUserImage(resp.user.profile_image_url);
      this.password = '';
      this.imageBase64 = null;
    } catch (e) {
      // optionally surface an error toast in the future
    }
  }
  logout() {
    this.sb.logout();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  openBalanceModal() {
    this.startingBalanceInput = this.startingBalance;
    this.balanceModalOpen = true;
  }
  closeBalanceModal() {
    this.balanceModalOpen = false;
  }
  async onImageSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      input.value = '';
      return;
    }
    const max = 6 * 1024 * 1024;
    if (file.size > max) {
      input.value = '';
      return;
    }
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error('read-error'));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    this.imageBase64 = base64;
    input.value = '';
  }
  async saveStartingBalance() {
    const val = parseFloat(String(this.startingBalanceInput));
    if (isFinite(val)) {
      const rounded = +val.toFixed(2);
      try {
        const { firstValueFrom } = await import('rxjs');
        await firstValueFrom(this.api.updateStartingBalance(rounded));
        this.sb.setStartingBalance(rounded);
        this.startingBalance = this.sb.getStartingBalance();
        this.updateChart();
      } catch {}
    }
    this.closeBalanceModal();
  }

  private updateChart() {
    const p = this.sb.getCurrentParticipant();
    const all = this.sb.listExpenses();
    const expenses = all.filter((e) => e.resolved); // ONLY resolved affect balance chart
    this.unresolvedCount = all.filter((e) => !e.resolved).length;
    const byDate = new Map<string, number>();
    if (p) {
      for (const e of expenses) {
        const owed = this.sb.shareOfParticipant(e, p.id);
        if (owed <= 0) continue;
        const iso = (e.date || e.createdAt || new Date().toISOString()).slice(
          0,
          10
        );
        byDate.set(iso, +(owed + (byDate.get(iso) || 0)).toFixed(2));
      }
    }
    const dates = [...byDate.keys()].sort();
    const today = new Date().toISOString().slice(0, 10);
    let running = 0;
    const estSeries: (number | null)[] = [];
    const actSeries: (number | null)[] = [];
    for (const d of dates) {
      running += byDate.get(d) || 0;
      const bal = +(this.startingBalance - running).toFixed(2);
      estSeries.push(bal);
      actSeries.push(d <= today ? bal : null);
    }
    if (dates.length === 0) {
      this.currentBalance = this.startingBalance;
    } else {
      const lastIdx = actSeries
        .map((v, i) => (v !== null ? i : -1))
        .filter((i) => i >= 0)
        .pop();
      this.currentBalance =
        lastIdx !== undefined && lastIdx !== -1
          ? (actSeries[lastIdx] as number)
          : this.startingBalance;
    }
    this.renderChart(dates, actSeries, estSeries);
  }

  private _chartBuildToken = 0;
  private destroyChart() {
    if (this.balanceChart) {
      this.balanceChart.destroy();
      this.balanceChart = undefined;
    }
  }

  private renderChart(
    labels: string[],
    actual: (number | null)[],
    estimated: (number | null)[]
  ) {
    const el = this.balanceChartRef?.nativeElement;
    if (!el) return;
    this.destroyChart();
    const buildToken = ++this._chartBuildToken;
    import('chart.js').then((mod) => {
      if (buildToken !== this._chartBuildToken) return; // superseded
      const { Chart, registerables } = mod as any;
      Chart.register(...registerables);
      this.balanceChart = new Chart(el.getContext('2d')!, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Current',
              data: actual,
              spanGaps: false,
              borderColor: 'hsl(220 80% 55%)',
              backgroundColor: 'hsl(220 80% 55% / 0.15)',
              tension: 0.25,
              pointRadius: 2,
            },
            {
              label: 'Estimated',
              data: estimated,
              borderDash: [6, 4],
              borderColor: 'hsl(270 70% 50%)',
              backgroundColor: 'hsl(270 70% 50% / 0.15)',
              tension: 0.25,
              pointRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          scales: { y: { beginAtZero: false } },
        },
      });
    });
  }
  togglePasswordVisibility() {
    const passwordInput = document.getElementById(
      'passwordInput'
    ) as HTMLInputElement;
    const toggleIcon = document.getElementById(
      'togglePasswordIcon'
    ) as HTMLIonIconElement;
    if (passwordInput && toggleIcon) {
      passwordInput.type =
        passwordInput.type === 'password' ? 'text' : 'password';
      toggleIcon.name =
        passwordInput.type === 'password' ? 'eye-off-outline' : 'eye-outline';
    }
  }

  ngAfterViewInit(): void {
    this.updateChart();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }
}
