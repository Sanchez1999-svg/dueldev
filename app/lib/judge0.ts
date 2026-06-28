const JUDGE0_HOST = process.env.JUDGE0_API_HOST || "judge0-ce.p.rapidapi.com";
const JUDGE0_KEY = process.env.JUDGE0_API_KEY;

const LANGUAGE_IDS: Record<string, number> = {
  Python: 71,
  JavaScript: 63,
  Java: 62,
  "C++": 54,
};

export function mapLanguage(language: string): number | null {
  return LANGUAGE_IDS[language] ?? null;
}

export function supportedLanguages(): string[] {
  return Object.keys(LANGUAGE_IDS);
}

type RunResult = {
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  status: string;
  time: string | null;
  memory: number | null;
};

export async function runCode(params: { code: string; languageId: number; stdin?: string }): Promise<RunResult> {
  if (!JUDGE0_KEY) {
    throw new Error("JUDGE0_API_KEY is not configured");
  }

  const res = await fetch(`https://${JUDGE0_HOST}/submissions?base64_encoded=false&wait=true`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-RapidAPI-Key": JUDGE0_KEY,
      "X-RapidAPI-Host": JUDGE0_HOST,
    },
    body: JSON.stringify({
      source_code: params.code,
      language_id: params.languageId,
      stdin: params.stdin ?? "",
      cpu_time_limit: 5,
      memory_limit: 128000,
    }),
  });

  if (!res.ok) {
    throw new Error(`Judge0 request failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    stdout: data.stdout ?? null,
    stderr: data.stderr ?? null,
    compileOutput: data.compile_output ?? null,
    status: data.status?.description ?? "unknown",
    time: data.time ?? null,
    memory: data.memory ?? null,
  };
}

// Run many submissions in one batch. Used for judging a solution against all
// of a problem's test cases: instead of N separate Judge0 requests (one per
// test, which burns the free-tier quota fast), this is one POST plus a few
// polls. Results are returned in the same order as the input.
export async function runBatch(
  items: { code: string; languageId: number; stdin?: string }[]
): Promise<RunResult[]> {
  if (!JUDGE0_KEY) throw new Error("JUDGE0_API_KEY is not configured");
  if (items.length === 0) return [];

  const headers = {
    "content-type": "application/json",
    "X-RapidAPI-Key": JUDGE0_KEY,
    "X-RapidAPI-Host": JUDGE0_HOST,
  };

  const createRes = await fetch(`https://${JUDGE0_HOST}/submissions/batch?base64_encoded=false`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      submissions: items.map(it => ({
        source_code: it.code,
        language_id: it.languageId,
        stdin: it.stdin ?? "",
        cpu_time_limit: 5,
        memory_limit: 128000,
      })),
    }),
  });
  if (!createRes.ok) throw new Error(`Judge0 batch create failed: ${createRes.status}`);
  const tokens: string[] = (await createRes.json()).map((s: { token: string }) => s.token);

  const tokenParam = tokens.join(",");
  const fields = "stdout,stderr,compile_output,status,time,memory";

  // Poll until every submission has finished (status id 1=queue, 2=processing).
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(
      `https://${JUDGE0_HOST}/submissions/batch?tokens=${tokenParam}&base64_encoded=false&fields=${fields}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Judge0 batch poll failed: ${res.status}`);
    const subs = (await res.json()).submissions as Array<{
      stdout: string | null; stderr: string | null; compile_output: string | null;
      status: { id: number; description: string }; time: string | null; memory: number | null;
    }>;

    const pending = subs.some(s => !s.status || s.status.id <= 2);
    if (!pending) {
      return subs.map(s => ({
        stdout: s.stdout ?? null,
        stderr: s.stderr ?? null,
        compileOutput: s.compile_output ?? null,
        status: s.status?.description ?? "unknown",
        time: s.time ?? null,
        memory: s.memory ?? null,
      }));
    }
    await new Promise(r => setTimeout(r, 600));
  }
  throw new Error("Judge0 batch timed out");
}
