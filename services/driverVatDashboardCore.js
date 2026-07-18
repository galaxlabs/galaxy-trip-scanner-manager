function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export function isReadyInvoice(row) {
  return normalize(row?.status || row?.invoice_status) === "ready";
}

export function buildStaffLabel(staff) {
  const staffName = String(staff?.full_name || staff?.name || "").trim();
  const driverName = String(staff?.driver || "").trim();

  if (driverName && normalize(driverName) !== normalize(staffName)) {
    return `${staffName} - ${driverName}`;
  }

  return staffName || driverName || "Unnamed driver";
}

export function findCurrentStaff(staffRows, user) {
  const identity = normalize(user?.username);
  if (!identity || identity === "administrator") return undefined;

  return staffRows.find((staff) => {
    return [
      staff?.email,
      staff?.name,
      staff?.full_name,
      staff?.driver,
    ].some((value) => normalize(value) === identity);
  });
}

export function matchesSelectedDriver(row, selectedDriver, vatMode) {
  if (vatMode && vatMode !== 'All' && row?.vatMode !== vatMode) return false;
  return !selectedDriver || normalize(row?.driver) === normalize(selectedDriver);
}

export function matchesReadyInvoiceDateRange(row, fromDate, toDate) {
  if (!isReadyInvoice(row)) return false;
  const date = String(row?.date || row?.invoice_date || row?.creation || "").slice(0, 10);
  if (fromDate && (!date || date < fromDate)) return false;
  if (toDate && (!date || date > toDate)) return false;
  return true;
}
