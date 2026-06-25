import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUtc, translateRpcError, formatRelativeTime } from "../app/utils.ts";

test("parseUtc treats a tz-less Postgres timestamp as UTC", () => {
  // The original bug: Supabase returns `timestamp` columns without a `Z`,
  // and `new Date(...)` would parse them in the local zone. parseUtc must
  // force UTC so the value matches the same instant with an explicit Z.
  const naive = "2026-06-23T21:55:47.043";
  assert.equal(parseUtc(naive).getTime(), Date.parse("2026-06-23T21:55:47.043Z"));
});

test("parseUtc leaves an already-zoned timestamp untouched", () => {
  const withZ = "2026-06-23T21:55:47.043Z";
  assert.equal(parseUtc(withZ).getTime(), Date.parse(withZ));

  const withOffset = "2026-06-23T21:55:47.043+00:00";
  assert.equal(parseUtc(withOffset).getTime(), Date.parse(withOffset));
});

test("translateRpcError maps known backend errors to Russian", () => {
  assert.equal(translateRpcError("insufficient balance"), "Недостаточно средств на балансе");
  assert.equal(translateRpcError("duel already accepted"), "Дуэль уже принята другим игроком");
  assert.equal(translateRpcError("only the creator can cancel this duel"), "Отменить вызов может только его создатель");
  assert.equal(translateRpcError("only an open duel can be cancelled"), "Можно отменить только ещё не принятый вызов");
});

test("translateRpcError matches on substrings (errors include extra context)", () => {
  assert.equal(
    translateRpcError('new row violates ... "insufficient balance" ...'),
    "Недостаточно средств на балансе"
  );
});

test("translateRpcError falls back for unknown/empty input", () => {
  const fallback = "Что-то пошло не так, попробуй обновить страницу";
  assert.equal(translateRpcError("some unmapped postgres error"), fallback);
  assert.equal(translateRpcError(null), fallback);
  assert.equal(translateRpcError(undefined), fallback);
});

test("formatRelativeTime rolls minutes up into hours and days", () => {
  const now = Date.parse("2026-06-26T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  assert.equal(formatRelativeTime(ago(30_000), now), "только что");
  assert.equal(formatRelativeTime(ago(5 * MIN), now), "5 мин назад");
  assert.equal(formatRelativeTime(ago(59 * MIN), now), "59 мин назад");
  assert.equal(formatRelativeTime(ago(90 * MIN), now), "1 ч назад");
  assert.equal(formatRelativeTime(ago(23 * HOUR), now), "23 ч назад");
  assert.equal(formatRelativeTime(ago(25 * HOUR), now), "1 дн назад");
  assert.equal(formatRelativeTime(ago(5 * DAY), now), "5 дн назад");
});
