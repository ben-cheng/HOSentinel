/**
 * Time and date utilities for HOS logging
 */

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMinuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function getPreviousLocalDateKey(date: Date | string): string {
  const previousDate =
    date instanceof Date ? new Date(date) : new Date(`${date}T00:00:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  return getLocalDateKey(previousDate);
}

export function getNextLocalDateKey(date: Date | string): string {
  const nextDate =
    date instanceof Date ? new Date(date) : new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  return getLocalDateKey(nextDate);
}

export function isToday(dateKey: string): boolean {
  return dateKey === getLocalDateKey(new Date());
}

export function isPastDate(dateKey: string): boolean {
  return dateKey < getLocalDateKey(new Date());
}

export function isFutureDate(dateKey: string): boolean {
  return dateKey > getLocalDateKey(new Date());
}
