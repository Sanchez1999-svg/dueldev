import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapLanguage, runBatch } from "../../lib/judge0";
import { getProblem } from "../../lib/problems";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Normalize output for comparison: trim trailing whitespace on each line and
// drop trailing blank lines, so "6\n" == "6" and stray spaces don't fail a
// correct answer.
function normalize(s: string | null): string {
  if (!s) return "";
  return s.replace(/\r\n/g, "\n").split("\n").map(l => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const code = body?.code;
  const language = body?.language;
  const problemId = body?.problemId;

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  if (code.length > 20000) {
    return NextResponse.json({ error: "code is too long" }, { status: 400 });
  }
  const languageId = typeof language === "string" ? mapLanguage(language) : null;
  if (!languageId) return NextResponse.json({ error: "unsupported language" }, { status: 400 });

  const problem = typeof problemId === "string" ? getProblem(problemId) : null;
  if (!problem) return NextResponse.json({ error: "unknown problem" }, { status: 400 });

  const results: Record<string, unknown>[] = [];
  let passed = 0;

  let outs;
  try {
    outs = await runBatch(problem.tests.map(t => ({ code, languageId, stdin: t.stdin })));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "judging failed" }, { status: 502 });
  }

  problem.tests.forEach((test, i) => {
    const out = outs[i];
    const ok = !!out && out.status === "Accepted" && normalize(out.stdout) === normalize(test.expected);
    if (ok) passed++;
    results.push({
      sample: test.sample,
      passed: ok,
      status: out?.status ?? "error",
      // Reveal details only for sample tests; hidden tests stay opaque.
      ...(test.sample
        ? { stdin: test.stdin, expected: test.expected, got: out?.stdout ?? null, stderr: out?.stderr ?? null, compileOutput: out?.compileOutput ?? null }
        : {}),
    });
  });

  return NextResponse.json({
    problemId: problem.id,
    total: problem.tests.length,
    passed,
    allPassed: passed === problem.tests.length,
    results,
  });
}
