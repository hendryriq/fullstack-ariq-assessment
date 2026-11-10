const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const wibDateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const wibDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

const wibTime = new Intl.DateTimeFormat("en-GB", {
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const monthLabel = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatLessonTime(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  return `${wibDate.format(start)}, ${wibTime.format(start)} to ${wibTime.format(end)} WIB`;
}

// A logbook month is stored as its first day, for example 2026-10-01.
export function formatMonth(month: string) {
  return monthLabel.format(new Date(`${month}T00:00:00Z`));
}

export function isPast(value: string) {
  return new Date(value).getTime() <= Date.now();
}

export function formatAge(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);

  if (days <= 0) {
    return "Today";
  }

  return days === 1 ? "1 day" : `${days} days`;
}

const wibYearMonth = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  timeZone: "Asia/Jakarta",
});

// The first day of the WIB month a time falls in, as logbooks store it.
export function wibMonthStart(value: string) {
  return `${wibYearMonth.format(new Date(value))}-01`;
}

export function isMonthOver(month: string) {
  const [year, nextMonthIndex] = month.split("-").map(Number);

  // 00:00 WIB on the first of the next month is 17:00 UTC the day before.
  return Date.UTC(year, nextMonthIndex, 1, -7) <= Date.now();
}

export function formatRupiah(amount: number) {
  return rupiah.format(amount);
}

export function formatDateTime(value: string) {
  return `${wibDateTime.format(new Date(value))} WIB`;
}

// Negative durations show how far a student is overdrawn.
export function formatDuration(totalMinutes: number) {
  const sign = totalMinutes < 0 ? "-" : "";
  const minutes = Math.abs(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (remainder === 0) {
    return `${sign}${hours} h`;
  }

  return hours === 0
    ? `${sign}${remainder} min`
    : `${sign}${hours} h ${remainder} min`;
}
