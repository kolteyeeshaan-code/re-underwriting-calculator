/** Calendar dates stay as local calendar days; the CFO ledger stores YYYY-MM-DD. */
export function parsePickerDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) return undefined;

  // setFullYear also preserves years 0001–0099 instead of interpreting 1901–1999.
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date;
}

export function formatPickerDate(date: Date | undefined): string {
  if (!date || !Number.isFinite(date.getTime())) return '';
  const year = date.getFullYear();
  if (year < 1 || year > 9999) return '';
  return `${String(year).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The simulation uses GST (UTC+4) wall-clock hours, never the browser's time zone. */
export function formatPickerTime(hour: number): string {
  if (!Number.isFinite(hour) || hour < 0 || hour >= 24) return '';
  const minutes = Math.round(hour * 60);
  if (minutes >= 1440) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function parsePickerTime(value: string): number | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return undefined;
  return Number(match[1]) + Number(match[2]) / 60;
}
