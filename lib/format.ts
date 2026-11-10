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

export function hasEnded(endsAt: string) {
  return new Date(endsAt).getTime() <= Date.now();
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
