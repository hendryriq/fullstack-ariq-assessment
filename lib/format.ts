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
