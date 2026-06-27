import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapLanguage, runCode } from "../../../lib/judge0";
import { getProblem } from "../../../lib/problems";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalize(s: string | null): string {
  if (!s) return "";
  return s.replace(/\r\n/g, "\n").split("\n").map(l => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
}

// Ranked submission: judge the code against hidden tests and record the
// verified score server-side, then finalize the duel once both players are in.
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
  const duelId = body?.duelId;
  const code = body?.code;
  const language = body?.language;

  if (typeof duelId !== "string") return NextResponse.json({ error: "duelId is required" }, { status: 400 });
  if (typeof code !== "string" || !code.trim()) return NextResponse.json({ error: "code is required" }, { status: 400 });
  if (code.length > 20000) return NextResponse.json({ error: "code is too long" }, { status: 400 });
  const languageId = typeof language === "string" ? mapLanguage(language) : null;
  if (!languageId) return NextResponse.json({ error: "unsupported language" }, { status: 400 });

  // Service-role client: bypasses RLS so it can read the duel, write the
  // scored solution (the ranked-insert trigger only allows service_role),
  // and finalize.
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: duel } = await admin.from("duels").select("*").eq("id", duelId).single();
  if (!duel) return NextResponse.json({ error: "duel not found" }, { status: 404 });
  if (!duel.problem_id) return NextResponse.json({ error: "not a ranked duel" }, { status: 400 });
  if (duel.status !== "live") return NextResponse.json({ error: "duel is not live" }, { status: 400 });
  if (user.id !== duel.creator_id && user.id !== duel.opponent_id) {
    return NextResponse.json({ error: "not a participant" }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("solutions").select("id").eq("duel_id", duelId).eq("user_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ error: "already submitted" }, { status: 409 });

  const problem = getProblem(duel.problem_id);
  if (!problem) return NextResponse.json({ error: "unknown problem" }, { status: 400 });

  // Run every test case.
  let passed = 0;
  for (const test of problem.tests) {
    try {
      const out = await runCode({ code, languageId, stdin: test.stdin });
      if (out.status === "Accepted" && normalize(out.stdout) === normalize(test.expected)) passed++;
    } catch {
      // a failed run counts as a failed test
    }
  }
  const total = problem.tests.length;

  const { error: insErr } = await admin.from("solutions").insert({
    duel_id: duelId, user_id: user.id, code, score: passed, total,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // If both players have now submitted, finalize by score.
  const { count } = await admin
    .from("solutions").select("id", { count: "exact", head: true }).eq("duel_id", duelId);
  let finalized = false;
  if ((count ?? 0) >= 2) {
    const { error: finErr } = await admin.rpc("finish_ranked_duel", { p_duel_id: duelId });
    if (!finErr) finalized = true;
  }

  return NextResponse.json({ passed, total, allPassed: passed === total, finalized });
}
