import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User } from '../shared/models';
import { API } from './api';
interface AuthResponse { token: string; user: User; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(this.readUser());

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API}/auth/login`, { email, password }).pipe(tap((response) => this.save(response)));
  }

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API}/auth/register`, { name, email, password }).pipe(tap((response) => this.save(response)));
  }

  logout(): void {
    localStorage.removeItem('thniyti_token');
    localStorage.removeItem('thniyti_user');
    this.user.set(null);
  }

  token(): string | null {
    return localStorage.getItem('thniyti_token');
  }

  private save(response: AuthResponse): void {
    localStorage.setItem('thniyti_token', response.token);
    localStorage.setItem('thniyti_user', JSON.stringify(response.user));
    this.user.set(response.user);
  }

  private readUser(): User | null {
    const stored = localStorage.getItem('thniyti_user');
    return stored ? JSON.parse(stored) as User : null;
  }
}
