import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="auth-card">
      <p class="eyebrow">{{ registerMode ? 'Join the community' : 'Welcome back' }}</p>
      <h1>{{ registerMode ? 'Create your account' : 'Log in to Thniyti' }}</h1>
      <p class="muted">Share the journey. Make every commute easier.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        @if (registerMode) { <label>Name <input formControlName="name" placeholder="Your name"></label> }
        <label>Email <input type="email" formControlName="email" placeholder="you@example.com"></label>
        <label>Password <input type="password" formControlName="password" placeholder="At least 8 characters"></label>
        @if (error) { <p class="error">{{ error }}</p> }
        <button class="button primary" [disabled]="form.invalid || loading">{{ loading ? 'Please wait…' : (registerMode ? 'Create account' : 'Log in') }}</button>
      </form>
      <button class="link-button" (click)="toggle()">{{ registerMode ? 'Already have an account? Log in' : 'New here? Create an account' }}</button>
    </section>
  `,
})
export class AuthComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  registerMode = false;
  loading = false;
  error = '';
  form = this.fb.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  toggle(): void { this.registerMode = !this.registerMode; this.error = ''; }
  submit(): void {
    if (this.form.invalid) return;
    this.loading = true; this.error = '';
    const value = this.form.getRawValue();
    const request = this.registerMode
      ? this.auth.register(value.name ?? '', value.email ?? '', value.password ?? '')
      : this.auth.login(value.email ?? '', value.password ?? '');
    request.subscribe({ next: () => this.router.navigate(['/']), error: (e) => { this.error = e.error?.message ?? 'Unable to continue'; this.loading = false; } });
  }
}
