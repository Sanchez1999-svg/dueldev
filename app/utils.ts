// Postgres `timestamp` columns are returned by Supabase without a UTC suffix,
// which makes `new Date(...)` parse them as local time instead of UTC.
export function parseUtc(timestamp: string) {
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(timestamp);
  return new Date(hasTimezone ? timestamp : `${timestamp}Z`);
}
