import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, tap } from 'rxjs';

type LoginResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    starting_balance?: number;
    balance?: number;
  };
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  // Backend base URL (from environment)
  private baseUrl = environment.apiBaseUrl;

  get apiBaseUrl(): string {
    return this.baseUrl;
  }

  get token(): string | null {
    return localStorage.getItem('auth:token');
  }

  set token(val: string | null) {
    if (val) localStorage.setItem('auth:token', val);
    else localStorage.removeItem('auth:token');
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.baseUrl}/auth/login`, { email, password })
      .pipe(tap((res) => (this.token = res.token)));
  }

  register(
    name: string,
    email: string,
    password: string
  ): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.baseUrl}/auth/register`, {
        name,
        email,
        password,
      })
      .pipe(tap((res) => (this.token = res.token)));
  }

  me(): Observable<LoginResponse['user']> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.token}` });
    return this.http.get<LoginResponse['user']>(`${this.baseUrl}/auth/me`, {
      headers,
    });
  }

  logout() {
    this.token = null;
  }
}
