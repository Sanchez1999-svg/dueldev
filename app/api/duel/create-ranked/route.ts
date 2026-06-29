import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapLanguage, runBatch } from "../../../lib/judge0";
import { getProblem } from "../../../lib/problems";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalize(s: string | null): string {
  if (!s) return "";
  return s.replace(/\r\n/g, "\n").split("\n").map(l => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
}

const ALLOWED_DURATIONS = [15, 30, 60, 1440];

// Async ranked challenge: the creator solves the problem up front; their
// score is locked in and the duel is published as an open challenge for
// anyone to try to beat later. Neither player needs to be online at the
// same time.
export async function POST(req: NextRequest) {
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 500 });
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const problemId = body?.problemId;
  const code = body?.code;
  const language = body?.language;
  const stake = Number(body?.stake);
  const durationMinutes = Number(body?.durationMinutes);

  if (typeof code !== "string" || !code.trim()) return NextResponse.json({ error: "code is required" }, { status: 400 });
  if (code.length > 20000) return NextResponse.json({ error: "code is too long" }, { status: 400 });
  const languageId = typeof language === "string" ? mapLanguage(language) : null;
  if (!languageId) return NextResponse.json({ error: "unsupported language" }, { status: 400 });
  if (!Number.isFinite(stake) || stake <= 0) return NextResponse.json({ error: "invalid stake" }, { status: 400 });
  if (!ALLOWED_DURATIONS.includes(durationMinutes)) return NextResponse.json({ error: "invalid duration" }, { status: 400 });

  const problem = typeof problemId === "string" ? getProblem(problemId) : null;
  if (!problem) return NextResponse.json({ error: "unknown problem" }, { status: 400 });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // Enough balance?
  const { data: prof } = await admin.from("profiles").select("balance").eq("id", user.id).single();
  if (!prof || prof.balance < stake) return NextResponse.json({ error: "insufficient balance" }, { status: 400 });

  // Judge the creator's own solution.
  let passed = 0;
  try {
    const outs = await runBatch(problem.tests.map(t => ({ code, languageId, stdin: t.stdin })));
    problem.tests.forEach((test, i) => {
      const out = outs[i];
      if (out && out.status === "Accepted" && normalize(out.stdout) === normalize(test.expected)) passed++;
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "judging failed" }, { status: 502 });
  }
  const total = problem.tests.length;

  // Must solve at least one test to publish a challenge.
  if (passed === 0) {
    return NextResponse.json({ error: "Реши хотя бы один тест, чтобы бросить вызов", passed, total }, { status: 400 });
  }

  // Create the open challenge.
  const { data: duelRows, error: duelErr } = await admin.from("duels").insert({
    creator_id: user.id,
    task: problem.statement,
    language: "Любой",
    duration_minutes: durationMinutes,
    stake,
    status: "open",
    problem_id: problem.id,
  }).select();
  if (duelErr) return NextResponse.json({ error: duelErr.message }, { status: 400 });
  const duelId = duelRows[0].id;

  // Record the creator's locked-in solution + score.
  const { error: solErr } = await admin.from("solutions").insert({
    duel_id: duelId, user_id: user.id, code, score: passed, total,
  });
  if (solErr) {
    await admin.from("duels").delete().eq("id", duelId); // roll back the duel
    return NextResponse.json({ error: solErr.message }, { status: 500 });
  }

  // Deduct the stake.
  await admin.from("profiles").update({ balance: prof.balance - stake }).eq("id", user.id);

  return NextResponse.json({ duelId, passed, total });
}
