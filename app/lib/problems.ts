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

  "max-of-list": {
    id: "max-of-list",
    title: "Максимум",
    statement: "Дан список целых чисел. Выведи наибольшее из них.",
    ioSpec: "Ввод: одна строка с целыми числами через пробел.\nВывод: одно целое число — максимум.",
    tests: [
      { stdin: "1 2 3", expected: "3", sample: true },
      { stdin: "100 -100 50", expected: "100", sample: true },
      { stdin: "5", expected: "5", sample: false },
      { stdin: "-1 -5 -3", expected: "-1", sample: false },
      { stdin: "10 10 9", expected: "10", sample: false },
      { stdin: "7 7", expected: "7", sample: false },
      { stdin: "-50", expected: "-50", sample: false },
    ],
  },

  "reverse-string": {
    id: "reverse-string",
    title: "Переворот строки",
    statement: "Дано слово. Выведи его задом наперёд.",
    ioSpec: "Ввод: одна строка (без пробелов).\nВывод: та же строка в обратном порядке.",
    tests: [
      { stdin: "hello", expected: "olleh", sample: true },
      { stdin: "abc", expected: "cba", sample: true },
      { stdin: "a", expected: "a", sample: false },
      { stdin: "12345", expected: "54321", sample: false },
      { stdin: "racecar", expected: "racecar", sample: false },
      { stdin: "Python", expected: "nohtyP", sample: false },
    ],
  },

  "is-palindrome": {
    id: "is-palindrome",
    title: "Палиндром",
    statement: "Дано слово в нижнем регистре. Выведи yes, если это палиндром (читается одинаково в обе стороны), иначе no.",
    ioSpec: "Ввод: одна строка (слово в нижнем регистре, без пробелов).\nВывод: yes или no.",
    tests: [
      { stdin: "level", expected: "yes", sample: true },
      { stdin: "hello", expected: "no", sample: true },
      { stdin: "a", expected: "yes", sample: false },
      { stdin: "abba", expected: "yes", sample: false },
      { stdin: "abc", expected: "no", sample: false },
      { stdin: "racecar", expected: "yes", sample: false },
      { stdin: "ab", expected: "no", sample: false },
    ],
  },

  "digit-sum": {
    id: "digit-sum",
    title: "Сумма цифр",
    statement: "Дано целое неотрицательное число. Выведи сумму его цифр.",
    ioSpec: "Ввод: одно неотрицательное целое число.\nВывод: одно целое число — сумма цифр.",
    tests: [
      { stdin: "123", expected: "6", sample: true },
      { stdin: "9999", expected: "36", sample: true },
      { stdin: "0", expected: "0", sample: false },
      { stdin: "10", expected: "1", sample: false },
      { stdin: "456", expected: "15", sample: false },
      { stdin: "7", expected: "7", sample: false },
      { stdin: "1000000", expected: "1", sample: false },
    ],
  },

  "fibonacci": {
    id: "fibonacci",
    title: "Число Фибоначчи",
    statement: "Дано целое число n (0 ≤ n ≤ 90). Выведи n-е число Фибоначчи. Считается, что F(0) = 0, F(1) = 1.",
    ioSpec: "Ввод: одно целое число n.\nВывод: n-е число Фибоначчи.",
    tests: [
      { stdin: "0", expected: "0", sample: true },
      { stdin: "10", expected: "55", sample: true },
      { stdin: "1", expected: "1", sample: false },
      { stdin: "7", expected: "13", sample: false },
      { stdin: "15", expected: "610", sample: false },
      { stdin: "2", expected: "1", sample: false },
      { stdin: "20", expected: "6765", sample: false },
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
