import type { User } from '../types';
import { FrappeClient } from './frappe';
import { buildStaffLabel, findCurrentStaff, isReadyInvoice, matchesReadyInvoiceDateRange, matchesSelectedDriver } from './driverVatDashboardCore.js';

export interface DriverVatDashboardFilters {
  fromDate: string;
  toDate: string;
  driver: string;
  vatMode: 'Included' | 'Excluded' | 'All';
  timeSpan: 'this_month' | 'last_30_days' | 'this_quarter' | 'custom';
  month: string;
}

export interface StaffOption {
  name: string;
  fullName: string;
  driverName: string;
  displayName: string;
  company: string;
  vehicle: string;
}

export interface DashboardSummary {
  totalTrips: number;
  totalKilometers: number;
  totalTripValue: number;
  totalNetBeforeVat: number;
  totalVatAmount: number;
  totalGrandTotal: number;
  activeDriversCount: number;
  averageValuePerTrip: number;
}

export interface DriverSummaryRow {
  driver: string;
  vehicleCount: number;
  tripCount: number;
  totalKilometers: number;
  tripValue: number;
  netBeforeVat: number;
  vatAmount: number;
  grandTotal: number;
  averagePerTrip: number;
}

export interface VehicleSummaryRow {
  vehicle: string;
  driver: string;
  tripCount: number;
  totalKilometers: number;
  tripValue: number;
  vatAmount: number;
  grandTotal: number;
}

export interface InvoiceDetailRow {
  invoiceNo: string;
  trip: string;
  date: string;
  driver: string;
  vehicle: string;
  company: string;
  customer: string;
  totalKm: number;
  tripValue: number;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  status: string;
  vatMode: 'Included' | 'Excluded';
}

export interface ChartMetric {
  label: string;
  value: number;
}

export interface DriverVatDashboardData {
  summary: DashboardSummary;
  driverRows: DriverSummaryRow[];
  vehicleRows: VehicleSummaryRow[];
  detailRows: InvoiceDetailRow[];
  charts: {
    vatByDriver: ChartMetric[];
    tripValueByDriver: ChartMetric[];
    tripsCountByDriver: ChartMetric[];
    kilometersByDriver: ChartMetric[];
  };
  options: {
    staff: StaffOption[];
    months: string[];
  };
  context: {
    isStaffView: boolean;
    selectedStaff?: StaffOption;
  };
}

type AnyRecord = Record<string, any>;
type TripRow = ReturnType<typeof normalizeTrip>;
type InvoiceRow = ReturnType<typeof normalizeInvoice>;

const FALLBACK_DRIVER = 'Unassigned';
const FALLBACK_VEHICLE = 'Unassigned';
const FALLBACK_CUSTOMER = 'Walk-in';
const VAT_DEFAULT = 15;

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateKey = (value: unknown): string => {
  if (!value) return '';
  const text = String(value);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10);
};

const mapVatMode = (row: AnyRecord): 'Included' | 'Excluded' => {
  const text = String(row.vat_mode || '').toLowerCase();
  if (text.includes('include')) return 'Included';
  if (text.includes('exclude')) return 'Excluded';
  return row.vat_included === 1 || row.vat_included === true || row.vat_included === '1'
    ? 'Included'
    : 'Excluded';
};

const buildRangeFromMonth = (month: string) => {
  if (!month) return { fromDate: '', toDate: '' };
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) {
    return { fromDate: '', toDate: '' };
  }
  return {
    fromDate: new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10),
    toDate: new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10),
  };
};

export function getSuggestedRange(timeSpan: DriverVatDashboardFilters['timeSpan'], month: string) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (timeSpan === 'custom') return buildRangeFromMonth(month);
  if (timeSpan === 'this_month') {
    return {
      fromDate: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)).toISOString().slice(0, 10),
      toDate: end.toISOString().slice(0, 10),
    };
  }
  if (timeSpan === 'this_quarter') {
    const quarterStartMonth = Math.floor(end.getUTCMonth() / 3) * 3;
    return {
      fromDate: new Date(Date.UTC(end.getUTCFullYear(), quarterStartMonth, 1)).toISOString().slice(0, 10),
      toDate: end.toISOString().slice(0, 10),
    };
  }
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { fromDate: start.toISOString().slice(0, 10), toDate: end.toISOString().slice(0, 10) };
}

async function getDashboardList(doctype: string, filters: AnyRecord, fields: string[]) {
  return FrappeClient.fetch('frappe.client.get_list', {
    doctype,
    filters: JSON.stringify(filters),
    fields: JSON.stringify(fields),
    limit_page_length: 500,
    order_by: 'creation desc',
  });
}

function toStaffOption(row: AnyRecord): StaffOption {
  return {
    name: String(row.name || row.full_name || ''),
    fullName: String(row.full_name || row.name || ''),
    driverName: String(row.driver || ''),
    displayName: buildStaffLabel(row),
    company: String(row.company_name || ''),
    vehicle: String(row.vehicle_assigned || ''),
  };
}

function resolveStaff(row: AnyRecord, staffRows: AnyRecord[]) {
  const identity = String(row.driver || row.captain || row.assigned_driver || '').trim().toLowerCase();
  return staffRows.find((staff) =>
    [staff.name, staff.full_name, staff.driver]
      .some((value) => String(value || '').trim().toLowerCase() === identity)
  );
}

function normalizeTrip(row: AnyRecord, staffRows: AnyRecord[]) {
  const staff = resolveStaff(row, staffRows);
  return {
    name: String(row.name || ''),
    driver: String(staff?.name || row.driver || FALLBACK_DRIVER),
    driverLabel: staff ? buildStaffLabel(staff) : String(row.driver || FALLBACK_DRIVER),
    company: String(staff?.company_name || row.company || ''),
    vehicle: String(staff?.vehicle_assigned || row.assigned_vehicle || row.vehicle || FALLBACK_VEHICLE),
    totalKm: toNumber(row.distance || row.total_km || row.distance_km || row.km),
    tripValue: toNumber(row.trip_value || row.trip_amount || row.total_amount || row.grand_total),
  };
}

function normalizeInvoice(row: AnyRecord, trip?: TripRow) {
  const vatMode = mapVatMode(row);
  const vatRate = toNumber(row.vat_rate || VAT_DEFAULT) || VAT_DEFAULT;
  const grandTotal = toNumber(row.grand_total || row.rounded_total || row.base_grand_total);
  let netAmount = toNumber(row.net_total || row.net_amount || row.base_net_total || row.amount_before_tax);
  let vatAmount = toNumber(row.vat_amount || row.total_taxes_and_charges || row.tax_amount);

  if (!netAmount && grandTotal) {
    netAmount = grandTotal / (1 + vatRate / 100);
    vatAmount = grandTotal - netAmount;
  } else if (!vatAmount && netAmount) {
    vatAmount = netAmount * vatRate / 100;
  }

  return {
    invoiceNo: String(row.name || ''),
    trip: String(row.trip || ''),
    date: toDateKey(row.invoice_date || row.posting_date || row.date || row.creation),
    driver: trip?.driver || FALLBACK_DRIVER,
    driverLabel: trip?.driverLabel || FALLBACK_DRIVER,
    company: trip?.company || String(row.company || ''),
    vehicle: trip?.vehicle || FALLBACK_VEHICLE,
    customer: String(row.customer_name_text || row.invoice_passenger_name || row.customer || FALLBACK_CUSTOMER),
    totalKm: trip?.totalKm || toNumber(row.distance || row.total_km),
    tripValue: trip?.tripValue || toNumber(row.trip_value || grandTotal),
    netAmount,
    vatRate,
    vatAmount,
    grandTotal: grandTotal || netAmount + vatAmount,
    status: String(row.status || ''),
    vatMode,
  };
}

function matchesFilters(row: InvoiceRow, filters: DriverVatDashboardFilters, effectiveDriver: string) {
  if (!matchesSelectedDriver(row, effectiveDriver)) return false;
  if (!matchesReadyInvoiceDateRange(row, filters.fromDate, filters.toDate)) return false;
  return true;
}

function sortMetrics(rows: ChartMetric[]) {
  return [...rows].sort((a, b) => b.value - a.value).slice(0, 8);
}

export async function getDriverVatDashboard(
  filters: DriverVatDashboardFilters,
  user?: User | null
): Promise<DriverVatDashboardData> {
  const staffRes = await getDashboardList(
    'Staff',
    { is_driver: 1 },
    ['name', 'full_name', 'email', 'driver', 'company_name', 'vehicle_assigned']
  );
  const staffRows: AnyRecord[] = staffRes.message || [];
  const currentStaff = findCurrentStaff(staffRows, user);
  const effectiveDriver = String(currentStaff?.name || filters.driver || '');

  const [tripRes, invoiceRes] = await Promise.all([
    getDashboardList(
      'Trip',
      effectiveDriver ? { driver: effectiveDriver } : {},
      ['name', 'driver', 'assigned_vehicle', 'distance', 'trip_value']
    ),
    getDashboardList(
      'Trip Invoice',
      {},
      [
        'name', 'creation', 'invoice_date', 'status', 'trip', 'company', 'customer',
        'invoice_passenger_name', 'trip_value', 'distance', 'vat_mode', 'vat_rate',
        'net_total', 'vat_amount', 'grand_total', 'invoice_scope', 'invoice_scope',
      ]
    ),
  ]);

  const trips: TripRow[] = (tripRes.message || []).map((row: AnyRecord) => normalizeTrip(row, staffRows));
  const tripByName = new Map(trips.map((row) => [row.name, row]));
  const invoices: InvoiceRow[] = (invoiceRes.message || [])
    .filter(isReadyInvoice)
    .map((row: AnyRecord) => normalizeInvoice(row, tripByName.get(String(row.trip || ''))))
    .filter((row: InvoiceRow) => row.driver !== FALLBACK_DRIVER);

  const months = Array.from(new Set(invoices.map((row) => row.date.slice(0, 7)).filter(Boolean)))
    .sort()
    .reverse();
  const filteredInvoices = invoices.filter((row) => matchesFilters(row, filters, effectiveDriver));

  const uniqueTrips = new Map<string, InvoiceRow>();
  for (const row of filteredInvoices) uniqueTrips.set(row.trip || row.invoiceNo, row);
  const uniqueTripRows = Array.from(uniqueTrips.values());
  const totalTrips = uniqueTripRows.length;
  const totalKilometers = uniqueTripRows.reduce((sum, row) => sum + row.totalKm, 0);
  const totalTripValue = uniqueTripRows.reduce((sum, row) => sum + row.tripValue, 0);
  const totalNetBeforeVat = filteredInvoices.reduce((sum, row) => sum + row.netAmount, 0);
  const totalVatAmount = filteredInvoices.reduce((sum, row) => sum + row.vatAmount, 0);
  const totalGrandTotal = filteredInvoices.reduce((sum, row) => sum + row.grandTotal, 0);

  const driverMap = new Map<string, {
    label: string;
    vehicles: Set<string>;
    trips: Map<string, InvoiceRow>;
    netBeforeVat: number;
    vatAmount: number;
    grandTotal: number;
  }>();
  for (const row of filteredInvoices) {
    const bucket = driverMap.get(row.driver) || {
      label: row.driverLabel,
      vehicles: new Set<string>(),
      trips: new Map<string, InvoiceRow>(),
      netBeforeVat: 0,
      vatAmount: 0,
      grandTotal: 0,
    };
    bucket.vehicles.add(row.vehicle);
    bucket.trips.set(row.trip || row.invoiceNo, row);
    bucket.netBeforeVat += row.netAmount;
    bucket.vatAmount += row.vatAmount;
    bucket.grandTotal += row.grandTotal;
    driverMap.set(row.driver, bucket);
  }

  const driverRows: DriverSummaryRow[] = Array.from(driverMap.values()).map((bucket) => {
    const tripRows = Array.from(bucket.trips.values());
    return {
      driver: bucket.label,
      vehicleCount: bucket.vehicles.size,
      tripCount: tripRows.length,
      totalKilometers: tripRows.reduce((sum, row) => sum + row.totalKm, 0),
      tripValue: tripRows.reduce((sum, row) => sum + row.tripValue, 0),
      netBeforeVat: bucket.netBeforeVat,
      vatAmount: bucket.vatAmount,
      grandTotal: bucket.grandTotal,
      averagePerTrip: tripRows.length ? bucket.grandTotal / tripRows.length : 0,
    };
  }).sort((a, b) => b.grandTotal - a.grandTotal);

  const vehicleMap = new Map<string, {
    vehicle: string;
    driver: string;
    trips: Map<string, InvoiceRow>;
    vatAmount: number;
    grandTotal: number;
  }>();
  for (const row of filteredInvoices) {
    const key = `${row.vehicle}__${row.driver}`;
    const bucket = vehicleMap.get(key) || {
      vehicle: row.vehicle,
      driver: row.driverLabel,
      trips: new Map<string, InvoiceRow>(),
      vatAmount: 0,
      grandTotal: 0,
    };
    bucket.trips.set(row.trip || row.invoiceNo, row);
    bucket.vatAmount += row.vatAmount;
    bucket.grandTotal += row.grandTotal;
    vehicleMap.set(key, bucket);
  }
  const vehicleRows: VehicleSummaryRow[] = Array.from(vehicleMap.values()).map((bucket) => {
    const tripRows = Array.from(bucket.trips.values());
    return {
      vehicle: bucket.vehicle,
      driver: bucket.driver,
      tripCount: tripRows.length,
      totalKilometers: tripRows.reduce((sum, row) => sum + row.totalKm, 0),
      tripValue: tripRows.reduce((sum, row) => sum + row.tripValue, 0),
      vatAmount: bucket.vatAmount,
      grandTotal: bucket.grandTotal,
    };
  }).sort((a, b) => b.grandTotal - a.grandTotal);

  const staffOptions = staffRows.map(toStaffOption).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const selectedStaffRow = currentStaff || staffRows.find((row) => String(row.name) === effectiveDriver);

  return {
    summary: {
      totalTrips,
      totalKilometers,
      totalTripValue,
      totalNetBeforeVat,
      totalVatAmount,
      totalGrandTotal,
      activeDriversCount: driverRows.length,
      averageValuePerTrip: totalTrips ? totalGrandTotal / totalTrips : 0,
    },
    driverRows,
    vehicleRows,
    detailRows: filteredInvoices.map((row) => ({
      invoiceNo: row.invoiceNo,
      trip: row.trip,
      date: row.date,
      driver: row.driverLabel,
      vehicle: row.vehicle,
      company: row.company,
      customer: row.customer,
      totalKm: row.totalKm,
      tripValue: row.tripValue,
      netAmount: row.netAmount,
      vatRate: row.vatRate,
      vatAmount: row.vatAmount,
      grandTotal: row.grandTotal,
      status: row.status,
      vatMode: row.vatMode,
    })),
    charts: {
      vatByDriver: sortMetrics(driverRows.map((row) => ({ label: row.driver, value: row.vatAmount }))),
      tripValueByDriver: sortMetrics(driverRows.map((row) => ({ label: row.driver, value: row.tripValue }))),
      tripsCountByDriver: sortMetrics(driverRows.map((row) => ({ label: row.driver, value: row.tripCount }))),
      kilometersByDriver: sortMetrics(driverRows.map((row) => ({ label: row.driver, value: row.totalKilometers }))),
    },
    options: { staff: staffOptions, months },
    context: {
      isStaffView: Boolean(currentStaff),
      selectedStaff: selectedStaffRow ? toStaffOption(selectedStaffRow) : undefined,
    },
  };
}
