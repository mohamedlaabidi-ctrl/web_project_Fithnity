import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BookingsService } from '../core/bookings.service';
import { Booking } from '../shared/models';

@Component({
  standalone: true,
  imports: [DatePipe],
  template: `<section class="section-heading"><div><p class="eyebrow">Your journeys</p><h1>My bookings</h1></div></section>@if (error) { <p class="error">{{ error }}</p> }<div class="ride-grid">@for (booking of bookings; track booking.id) { <article class="ride-card"><div class="ride-route"><strong>{{ booking.ride.origin }}</strong><span>→</span><strong>{{ booking.ride.destination }}</strong></div><p>{{ booking.ride.departureTime | date:'EEE, MMM d · h:mm a' }}</p><div class="ride-meta"><span>{{ booking.seats }} seat(s)</span><span class="status">{{ booking.status }}</span></div>@if (booking.status !== 'CANCELLED') { <button class="button secondary" (click)="cancel(booking)">Cancel booking</button> }</article>} @empty { <p class="muted">You have no bookings yet.</p> }</div>`,
})
export class BookingsComponent {
  private readonly service = inject(BookingsService); bookings: Booking[] = []; error = '';
  constructor() { this.load(); }
  load(): void { this.service.list().subscribe({ next: (items) => this.bookings = items, error: () => this.error = 'Could not load bookings' }); }
  cancel(booking: Booking): void { this.service.cancel(booking.id).subscribe({ next: () => this.load(), error: () => this.error = 'Could not cancel booking' }); }
}
