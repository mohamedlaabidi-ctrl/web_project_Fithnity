import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookingsService } from '../core/bookings.service';
import { AuthService } from '../core/auth.service';
import { RidesService } from '../core/rides.service';
import { Ride } from '../shared/models';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: `
    <section class="hero">
      <div><p class="eyebrow">Campus rides, made simple</p><h1>Find your next shared journey.</h1><p class="hero-copy">Connect with students heading your way and travel together.</p></div>
      <div class="hero-mark">↗</div>
    </section>
    <section class="search-panel">
      <h2>Find a ride</h2>
      <form [formGroup]="form" (ngSubmit)="search()">
        <label>From <input formControlName="origin" placeholder="Departure city"></label>
        <label>To <input formControlName="destination" placeholder="Destination"></label>
        <label>Date <input type="date" formControlName="date"></label>
        <button class="button primary">Search rides</button>
      </form>
    </section>
    <section class="section-heading"><div><p class="eyebrow">Available now</p><h2>Upcoming rides</h2></div><a routerLink="/rides/new">Offer a ride →</a></section>
    @if (loading) { <p class="muted">Loading rides…</p> }
    @if (error) { <p class="error">{{ error }}</p> }
    <div class="ride-grid">
      @for (ride of rides; track ride.id) {
        <article class="ride-card"><div class="ride-route"><strong>{{ ride.origin }}</strong><span>→</span><strong>{{ ride.destination }}</strong></div><p>{{ ride.departureTime | date:'EEE, MMM d · h:mm a' }}</p><div class="ride-meta"><span>{{ ride.seatsAvailable }} seats left</span><span>Driver: {{ ride.driver.name }}</span></div><button class="button secondary" (click)="book(ride)">Book a seat</button></article>
      } @empty { <p class="muted">No upcoming rides yet. Be the first to offer one.</p> }
    </div>
  `,
})
export class HomeComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ridesService = inject(RidesService); private readonly bookings = inject(BookingsService); private readonly auth = inject(AuthService); private readonly router = inject(Router);
  form = this.fb.group({ origin: [''], destination: [''], date: [''] });
  rides: Ride[] = []; loading = true; error = '';
  constructor() { this.search(); }
  search(): void {
    this.loading = true;
    const value = this.form.getRawValue();
    this.ridesService.list({ origin: value.origin ?? undefined, destination: value.destination ?? undefined, date: value.date ?? undefined }).subscribe({
      next: (rides) => { this.rides = rides; this.loading = false; },
      error: () => { this.error = 'Could not load rides'; this.loading = false; },
    });
  }
  book(ride: Ride): void {
    if (!this.auth.user()) { this.router.navigate(['/login']); return; }
    this.bookings.create(ride.id, 1).subscribe({
      next: () => { window.alert('Seat booked successfully.'); this.search(); },
      error: (e) => window.alert(e.error?.message ?? 'Could not book this ride.'),
    });
  }
}
