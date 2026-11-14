import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ride } from '../shared/models';
import { API } from './api';

@Injectable({ providedIn: 'root' })
export class RidesService {
  constructor(private readonly http: HttpClient) {}

  list(filters: { origin?: string; destination?: string; date?: string } = {}): Observable<Ride[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params = params.set(key, value); });
    return this.http.get<Ride[]>(`${API}/rides`, { params });
  }

  create(data: { origin: string; destination: string; departureTime: string; seatsAvailable: number }): Observable<Ride> {
    return this.http.post<Ride>(`${API}/rides`, data);
  }
}
