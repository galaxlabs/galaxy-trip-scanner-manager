
export type Language = 'en' | 'ar' | 'ur';

export interface Trip {
  name?: string;
  driver?: string;
  assigned_vehicle?: string;
  id_no?: string;
  compny?: string;
  compny_arabic?: string;
  compny_cr?: string;
  compny_reg?: string;
  phone?: string;
  model?: string;
  make?: string;
  reg_no?: string;
  no_plate?: string;
  uuid?: string;
  qr_code?: string;
  departure?: string;
  arrival?: string;
  trip_route?: string;
  route?: string;
  co_driver?: string;
  passengers?: Passenger[];
  trip_status?: string;
  from_location?: string;
  to_location?: string;
  distance?: number;
  duration_minutes?: number;
  is_return_trip?: number;
  date?: string;
}

export interface Passenger {
  passenger_name: string;
  document_number: string;
  nationality: string;
  contact_no?: string;
  document_type?: string;
  expiry_date?: string;
  passenger_master?: string;
  source?: string;
  is_auto_filled?: number;
}

export interface Route {
  name: string;
  from_place_full: string;
  to_place_full: string;
  distance: number;
  duration_minutes: number;
  return_route?: string;
}

export interface Staff {
  name: string;
  vehicle_assigned?: string;
}

export interface User {
  username: string;
  full_name: string;
}
