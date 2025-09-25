import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, map } from 'rxjs';

export type ApiBalance = {
  user_id: string;
  name: string;
  balance: number;
};

export type Balance = {
  userId: string;
  name: string;
  balance: number;
};

@Injectable({ providedIn: 'root' })
export class BackendApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  getGroupBalances(groupId: string): Observable<Balance[]> {
    return this.http
      .get<ApiBalance[]>(`${this.baseUrl}/groups/${groupId}/balances`)
      .pipe(
        map((rows) =>
          rows.map((r) => ({
            userId: r.user_id,
            name: r.name,
            balance: +r.balance,
          }))
        )
      );
  }

  addBalance(userId: string, amount: number) {
    return this.http.post(`${this.baseUrl}/balances/add`, {
      user_id: userId,
      amount,
    });
  }

  updateStartingBalance(startingBalance: number) {
    return this.http.put(`${this.baseUrl}/profile/starting-balance`, {
      starting_balance: startingBalance,
    });
  }

  updateProfile(payload: { name?: string; email?: string; password?: string }) {
    return this.http.put(`${this.baseUrl}/profile`, payload);
  }
}
