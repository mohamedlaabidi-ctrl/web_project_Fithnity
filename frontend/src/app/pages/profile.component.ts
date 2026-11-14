import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { API } from '../core/api';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `<section class="form-card"><p class="eyebrow">Your account</p><h1>Profile</h1><form [formGroup]="form" (ngSubmit)="save()"><label>Name <input formControlName="name"></label><label>Bio <textarea formControlName="bio" rows="4" placeholder="Tell fellow travellers a little about you"></textarea></label>@if (message) { <p class="success">{{ message }}</p> }@if (error) { <p class="error">{{ error }}</p> }<button class="button primary" [disabled]="form.invalid">Save changes</button></form></section>`,
})
export class ProfileComponent {
  private readonly fb = inject(FormBuilder); private readonly http = inject(HttpClient); private readonly auth = inject(AuthService);
  form = this.fb.group({ name: [this.auth.user()?.name ?? '', Validators.required], bio: [this.auth.user()?.bio ?? ''] }); message = ''; error = '';
  save(): void { this.http.patch<any>(`${API}/profile`, this.form.getRawValue()).subscribe({ next: (user) => { this.auth.user.set(user); localStorage.setItem('thniyti_user', JSON.stringify(user)); this.message = 'Profile updated'; }, error: (e) => this.error = e.error?.message ?? 'Unable to save profile' }); }
}
