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
