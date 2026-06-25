import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapLanguage, runCode } from "../../lib/judge0";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const code = body?.code;
  const language = body?.language;
  const stdin = body?.stdin;

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  if (code.length > 20000) {
    return NextResponse.json({ error: "code is too long" }, { status: 400 });
  }

  const languageId = typeof language === "string" ? mapLanguage(language) : null;
  if (!languageId) {
    return NextResponse.json({ error: "unsupported language" }, { status: 400 });
  }

  try {
    const result = await runCode({ code, languageId, stdin: typeof stdin === "string" ? stdin : undefined });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "execution failed" }, { status: 502 });
  }
}
