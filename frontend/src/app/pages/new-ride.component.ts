import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RidesService } from '../core/rides.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `<section class="form-card"><p class="eyebrow">Drive together</p><h1>Offer a ride</h1><p class="muted">Let other students join your journey.</p><form [formGroup]="form" (ngSubmit)="submit()"><label>From <input formControlName="origin"></label><label>To <input formControlName="destination"></label><label>Departure <input type="datetime-local" formControlName="departureTime"></label><label>Available seats <input type="number" min="1" max="8" formControlName="seatsAvailable"></label>@if (error) { <p class="error">{{ error }}</p> }<button class="button primary" [disabled]="form.invalid || loading">{{ loading ? 'Publishing…' : 'Publish ride' }}</button></form></section>`,
})
export class NewRideComponent {
  private readonly fb = inject(FormBuilder); private readonly rides = inject(RidesService); private readonly router = inject(Router);
  loading = false; error = '';
  form = this.fb.group({ origin: ['', Validators.required], destination: ['', Validators.required], departureTime: ['', Validators.required], seatsAvailable: [1, [Validators.required, Validators.min(1), Validators.max(8)]] });
  submit(): void { if (this.form.invalid) return; this.loading = true; this.rides.create(this.form.getRawValue() as { origin: string; destination: string; departureTime: string; seatsAvailable: number }).subscribe({ next: () => this.router.navigate(['/']), error: (e) => { this.error = e.error?.message ?? 'Unable to publish ride'; this.loading = false; } }); }
}
