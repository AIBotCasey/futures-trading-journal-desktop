export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // datetime-local expects local time with no timezone suffix
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalDateTimeInput(value: string): Date {
  // value like "2026-02-06T16:10"
  // new Date(value) is treated as local time in browsers
  return new Date(value);
}
