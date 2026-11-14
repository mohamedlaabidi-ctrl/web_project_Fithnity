export interface User {
  id: string;
  name: string;
  email: string;
  bio?: string | null;
  createdAt?: string;
}

export interface Ride {
  id: string;
  origin: string;
  destination: string;
  departureTime: string;
  seatsAvailable: number;
  driverId: string;
  driver: User;
}

export interface Booking {
  id: string;
  seats: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  ride: Ride;
  passenger: User;
}
