-- One-time promo bonus: +5000 DLC to every existing user, timed with the
-- ad campaign launch so returning/new visitors have plenty to play with.
-- DLC is the in-game virtual currency (no real monetary value) -- safe to
-- grant freely.
update public.profiles set balance = balance + 5000;
