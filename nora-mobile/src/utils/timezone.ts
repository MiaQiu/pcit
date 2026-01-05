/**
 * Timezone utilities for Singapore Time (UTC+8)
 * All date comparisons in the app should use Singapore timezone
 */

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000; // Singapore is UTC+8

/**
 * Convert a UTC timestamp to Singapore time and get the date string
 * @param date Date object or UTC timestamp
 * @returns Date string in format "Mon Jan 01 2024" in Singapore timezone
 */
export function toSingaporeDateString(date: Date | string | number): string {
  const utcDate = new Date(date);
  const sgtDate = new Date(utcDate.getTime() + SGT_OFFSET_MS);

  // Use UTC methods to avoid timezone conversion
  const year = sgtDate.getUTCFullYear();
  const month = sgtDate.getUTCMonth();
  const day = sgtDate.getUTCDate();

  // Create a date in UTC that represents the Singapore date
  const dateOnly = new Date(Date.UTC(year, month, day));
  return dateOnly.toDateString();
}

/**
 * Get today's date string in Singapore timezone
 */
export function getTodaySingapore(): string {
  return toSingaporeDateString(new Date());
}

/**
 * Get yesterday's date string in Singapore timezone
 */
export function getYesterdaySingapore(): string {
  return toSingaporeDateString(Date.now() - 86400000);
}

/**
 * Check if a timestamp is today in Singapore timezone
 */
export function isTodaySingapore(date: Date | string | number): boolean {
  return toSingaporeDateString(date) === getTodaySingapore();
}

/**
 * Check if two timestamps are on the same day in Singapore timezone
 */
export function isSameDaySingapore(date1: Date | string | number, date2: Date | string | number): boolean {
  return toSingaporeDateString(date1) === toSingaporeDateString(date2);
}

/**
 * Convert UTC timestamp to Singapore Date object
 * Useful for displaying dates to users
 */
export function toSingaporeDate(date: Date | string | number): Date {
  const utcDate = new Date(date);
  return new Date(utcDate.getTime() + SGT_OFFSET_MS);
}

/**
 * Get the start of today in Singapore timezone (as UTC timestamp)
 */
export function getStartOfTodaySingapore(): Date {
  const now = new Date();
  const sgtNow = new Date(now.getTime() + SGT_OFFSET_MS);

  // Get start of day in Singapore time
  const startOfDay = new Date(Date.UTC(
    sgtNow.getUTCFullYear(),
    sgtNow.getUTCMonth(),
    sgtNow.getUTCDate(),
    0, 0, 0, 0
  ));

  // Convert back to UTC timestamp
  return new Date(startOfDay.getTime() - SGT_OFFSET_MS);
}

/**
 * Get the end of today in Singapore timezone (as UTC timestamp)
 */
export function getEndOfTodaySingapore(): Date {
  const now = new Date();
  const sgtNow = new Date(now.getTime() + SGT_OFFSET_MS);

  // Get end of day in Singapore time
  const endOfDay = new Date(Date.UTC(
    sgtNow.getUTCFullYear(),
    sgtNow.getUTCMonth(),
    sgtNow.getUTCDate(),
    23, 59, 59, 999
  ));

  // Convert back to UTC timestamp
  return new Date(endOfDay.getTime() - SGT_OFFSET_MS);
}
