import "server-only";

// Server-only problem definitions with hidden test cases. Importing
// "server-only" guarantees this module never ships to the browser, so the
// expected outputs can't be read by players. For the vertical slice the
// problems live here as constants; once the model is proven this moves to a
// DB table (with RLS) so problems can be authored without a deploy.

export type TestCase = {
  stdin: string;
  expected: string;
  sample: boolean; // sample cases may be shown to the player; hidden ones never are
};

export type Problem = {
  id: string;
  title: string;
  statement: string;
  // How input/output works, shown to the player.
  ioSpec: string;
  tests: TestCase[];
};

const PROBLEMS: Record<string, Problem> = {
  "sum-of-list": {
    id: "sum-of-list",
    title: "Сумма чисел",
    statement:
      "Дан список целых чисел. Выведи их сумму.",
    ioSpec:
      "Ввод: одна строка с целыми числами через пробел.\nВывод: одно целое число — их сумма.",
    tests: [
      { stdin: "1 2 3", expected: "6", sample: true },
      { stdin: "10 20", expected: "30", sample: true },
      { stdin: "42", expected: "42", sample: false },
      { stdin: "-5 5", expected: "0", sample: false },
      { stdin: "0", expected: "0", sample: false },
      { stdin: "1 1 1 1 1", expected: "5", sample: false },
      { stdin: "-3 -7 -10", expected: "-20", sample: false },
    ],
  },
};

export function getProblem(id: string): Problem | null {
  return PROBLEMS[id] ?? null;
}

// Public list for the create-duel picker: id + title + short statement, no
// hidden test data.
export function listProblemsPublic() {
  return Object.values(PROBLEMS).map(p => ({
    id: p.id,
    title: p.title,
    statement: p.statement,
    ioSpec: p.ioSpec,
    totalTests: p.tests.length,
  }));
}

// Public-safe view of a problem: statement, io spec, and ONLY sample tests
// (hidden tests' expected outputs are stripped).
export function getProblemPublic(id: string) {
  const p = PROBLEMS[id];
  if (!p) return null;
  return {
    id: p.id,
    title: p.title,
    statement: p.statement,
    ioSpec: p.ioSpec,
    sampleTests: p.tests.filter(t => t.sample).map(t => ({ stdin: t.stdin, expected: t.expected })),
    totalTests: p.tests.length,
  };
}
