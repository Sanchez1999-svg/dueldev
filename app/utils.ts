// Postgres `timestamp` columns are returned by Supabase without a UTC suffix,
// which makes `new Date(...)` parse them as local time instead of UTC.
export function parseUtc(timestamp: string) {
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(timestamp);
  return new Date(hasTimezone ? timestamp : `${timestamp}Z`);
}

// RPCs (accept_duel, finish_duel, void_duel, resolve_duel_timeout) raise plain
// Postgres exceptions; map the known ones to friendly messages so the UI never
// shows raw backend text to the player.
const RPC_ERROR_MESSAGES: [string, string][] = [
  ["duel already accepted", "This duel was already accepted by another player"],
  ["cannot accept your own duel", "You can't accept your own challenge"],
  ["insufficient balance", "Not enough balance"],
  ["duel is not live", "This duel is already finished"],
  ["only a participant", "Only participants of this duel can do that"],
  ["winner must be a participant", "The winner must be a participant of the duel"],
  ["both participants must vote for the same winner", "Both players haven't voted for the same winner yet"],
  ["voiding requires two disagreeing votes", "Voiding requires votes from both participants"],
  ["deadline has not passed yet", "The duel's time hasn't run out yet"],
  ["only the creator can cancel this duel", "Only the creator can cancel this challenge"],
  ["only an open duel can be cancelled", "Only a not-yet-accepted challenge can be cancelled"],
  ["open duel limit reached", "Too many open challenges. Wait for them to be accepted or cancel some (max 5)"],
  ["duel not found", "Duel not found"],
  ["must be authenticated", "Session expired, please log in again"],
];

export function translateRpcError(message: string | undefined | null): string {
  if (!message) return "Something went wrong, try refreshing the page";
  const match = RPC_ERROR_MESSAGES.find(([needle]) => message.includes(needle));
  return match ? match[1] : "Something went wrong, try refreshing the page";
}

// Relative time. Old duels were showing things like "5870 min ago"; roll
// minutes up into hours and days. `now` is injectable for testing.
export function formatRelativeTime(timestamp: string, now: number = Date.now()): string {
  const diffMs = now - parseUtc(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
