
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
  trip_value?: number;
  trip_invoice_created?: boolean | number | string;
  trip_invoice?: string;
  invoice_passenger_name?: string;
  invoice_passenger_mobile?: string;
  billing_mode?: "Route Amount" | "KM Based" | "Manual";
  vat_mode?: "Included" | "Excluded" | "Manual VAT";
  vat_rate?: number;
  duration_minutes?: number;
  is_return_trip?: number;
  date?: string;
}

export interface Passenger {
  passenger_name: string;
  id_no?: string;
  mobile_no?: string;
  is_invoice_customer?: number;
  customer?: string;
  notes?: string;
  document_number?: string;
  nationality?: string;
  contact_no?: string;
  document_type?: string;
  expiry_date?: string;
  passenger_master?: string;
  source?: string;
  is_auto_filled?: number;
}

export interface TripInvoice {
  name?: string;
  trip?: string;
  doctype?: "Trip Invoice";
  company?: string;
  customer?: string;
  status?: "Draft" | "Ready" | "Sales Invoice Created" | "Cancelled";
  kashf_ready?: boolean | number | string;
  kashf_sent?: boolean | number | string;
  invoice_passenger_name?: string;
  invoice_passenger_mobile?: string;
  trip_route?: string;
  from_location?: string;
  to_location?: string;
  distance?: number;
  trip_value?: number;
  billing_mode?: "Route Amount" | "KM Based" | "Manual";
  vat_mode?: "Included" | "Excluded" | "Manual VAT";
  vat_rate?: number;
  net_total?: number;
  vat_amount?: number;
  grand_total?: number;
  items?: Array<{
    name?: string;
    doctype?: "Trip Invoice Item";
    source_type?: "Trip Route" | "Manual Item" | "Adjustment";
    trip?: string;
    route?: string;
    item_code?: string;
    description?: string;
    item_name?: string;
    qty?: number;
    rate?: number;
    amount?: number;
    vat_amount?: number;
    total_amount?: number;
    vat_rate?: number;
    vat_category?: "Standard 15%" | "Zero Rated" | "Exempt" | "Out of Scope";
    is_manual?: number;
  }>;
}

export interface Route {
  name: string;
  from_place_full: string;
  to_place_full: string;
  distance: number;
  route_value?: number;
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

export interface VehicleInspectionChecklistItem {
  name: string;
  item?: string;
  category?: string;
  sort_order?: number;
  is_active?: number;
}

export interface VehicleInspectionItem {
  name?: string;
  doctype?: 'Vehicle Inspection Item';
  section?: string;
  item_en?: string;
  item?: string;
  category?: string;
  status: 'Sound | سليم' | 'Unsound | غير سليم';
  notes?: string;
  sort_order?: number;
}

export interface VehicleInspectionLog {
  name?: string;
  naming_series?: string;
  inspection_no?: string;
  inspection_date?: string;
  driver?: string;
  vehicle?: string;
  vehicle_type?: string;
  items: VehicleInspectionItem[];
  auto_fill_checklist?: number;
  declaration?: string;
  driver_name_text?: string;
  driver_signature?: string;
  supervisor_name_text?: string;
  supervisor_signature?: string;
  overall_notes?: string;
}
