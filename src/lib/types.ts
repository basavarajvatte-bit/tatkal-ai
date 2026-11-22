export type ClassCode = 'SL' | '3A' | '2A' | '1A' | '3E' | 'CC' | 'EC' | '2S';
export type Quota = 'TQ' | 'PT' | 'GN';
export type Gender = 'M' | 'F' | 'T';
export type Berth = 'NP' | 'LB' | 'MB' | 'UB' | 'SL' | 'SU' | 'WS';

export interface Train {
  number: string; // 5 digits
  name: string;
  dep: string; // HH:MM at boarding station
  arr: string; // HH:MM at destination
  arrDays: number; // 0 = same day, 1 = next day...
  route?: string;
}

export interface Passenger {
  id: string;
  name: string;
  age: number | null;
  gender: Gender | '';
  berth: Berth;
  food?: string;
}

export interface Journey {
  id: string;
  label: string;
  from: string;
  to: string;
  boarding: string;
  journeyDate: string; // YYYY-MM-DD at boarding station
  boardingDay: number; // day of the train's run on which it reaches boarding station (1 = same day it starts)
  travelClass: ClassCode;
  quota: Quota;
  trains: Train[]; // [0] = preferred, [1..3] = alternatives
  passengers: Passenger[];
  checks: { irctcAccount: boolean; aadhaar: boolean; payment: boolean };
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export type BookingStatus = 'CONFIRMED' | 'RAC' | 'WL' | 'PAYMENT_PENDING' | 'PAYMENT_FAILED' | 'BOOKING_FAILED';

export interface Booking {
  id: string;
  pnr: string;
  train: string;
  journey: string;
  date: string;
  travelClass: ClassCode;
  status: BookingStatus;
  note: string;
  createdAt: number;
}

export interface Settings {
  notifications: boolean;
  preferredArrival: string; // HH:MM
}

export interface AppData {
  version: 1;
  journeys: Journey[];
  bookings: Booking[];
  settings: Settings;
}
