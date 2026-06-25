// Postgres `timestamp` columns are returned by Supabase without a UTC suffix,
// which makes `new Date(...)` parse them as local time instead of UTC.
export function parseUtc(timestamp: string) {
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(timestamp);
  return new Date(hasTimezone ? timestamp : `${timestamp}Z`);
}

// RPCs (accept_duel, finish_duel, void_duel, resolve_duel_timeout) raise plain
// Postgres exceptions; map the known ones to Russian messages so the UI never
// shows raw backend text to the player.
const RPC_ERROR_MESSAGES: [string, string][] = [
  ["duel already accepted", "Дуэль уже принята другим игроком"],
  ["cannot accept your own duel", "Нельзя принять свой собственный вызов"],
  ["insufficient balance", "Недостаточно средств на балансе"],
  ["duel is not live", "Дуэль уже завершена"],
  ["only a participant", "Действие доступно только участникам этой дуэли"],
  ["winner must be a participant", "Победителем может быть только участник дуэли"],
  ["both participants must vote for the same winner", "Голоса участников ещё не совпали"],
  ["voiding requires two disagreeing votes", "Для аннулирования нужны голоса от обоих участников"],
  ["deadline has not passed yet", "Время дуэли ещё не истекло"],
  ["duel not found", "Дуэль не найдена"],
  ["must be authenticated", "Сессия истекла, перезайди"],
];

export function translateRpcError(message: string | undefined | null): string {
  if (!message) return "Что-то пошло не так, попробуй обновить страницу";
  const match = RPC_ERROR_MESSAGES.find(([needle]) => message.includes(needle));
  return match ? match[1] : "Что-то пошло не так, попробуй обновить страницу";
}
