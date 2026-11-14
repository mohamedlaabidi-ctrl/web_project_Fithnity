import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking } from '../shared/models';

const API = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class BookingsService {
  constructor(private readonly http: HttpClient) {}
  list(): Observable<Booking[]> { return this.http.get<Booking[]>(`${API}/bookings`); }
  create(rideId: string, seats: number): Observable<Booking> { return this.http.post<Booking>(`${API}/bookings/rides/${rideId}`, { seats }); }
  cancel(id: string): Observable<Booking> { return this.http.patch<Booking>(`${API}/bookings/${id}/cancel`, {}); }
}
