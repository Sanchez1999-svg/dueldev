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
    title: "Sum of numbers",
    statement:
      "You're given a list of integers. Print their sum.",
    ioSpec:
      "Input: one line of integers separated by spaces.\nOutput: a single integer — their sum.",
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
    title: "Maximum",
    statement: "You're given a list of integers. Print the largest one.",
    ioSpec: "Input: one line of integers separated by spaces.\nOutput: a single integer — the maximum.",
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
    title: "Reverse a string",
    statement: "You're given a word. Print it backwards.",
    ioSpec: "Input: one line (no spaces).\nOutput: the same string reversed.",
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
    title: "Palindrome",
    statement: "You're given a lowercase word. Print yes if it's a palindrome (reads the same both ways), otherwise no.",
    ioSpec: "Input: one line (a lowercase word, no spaces).\nOutput: yes or no.",
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
    title: "Digit sum",
    statement: "You're given a non-negative integer. Print the sum of its digits.",
    ioSpec: "Input: a single non-negative integer.\nOutput: a single integer — the digit sum.",
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
    title: "Fibonacci number",
    statement: "You're given an integer n (0 ≤ n ≤ 90). Print the n-th Fibonacci number, where F(0) = 0, F(1) = 1.",
    ioSpec: "Input: a single integer n.\nOutput: the n-th Fibonacci number.",
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

  "count-words": {
    id: "count-words",
    title: "Word count",
    statement: "You're given a string. Print the number of words in it (words are separated by one or more spaces).",
    ioSpec: "Input: one line.\nOutput: a single integer — the number of words.",
    tests: [
      { stdin: "hello world", expected: "2", sample: true },
      { stdin: "one two three four", expected: "4", sample: true },
      { stdin: "a", expected: "1", sample: false },
      { stdin: "  spaced   out  text  ", expected: "3", sample: false },
      { stdin: "single", expected: "1", sample: false },
    ],
  },

  "gcd": {
    id: "gcd",
    title: "GCD of two numbers",
    statement: "You're given two positive integers. Print their greatest common divisor.",
    ioSpec: "Input: one line with two positive integers separated by a space.\nOutput: a single integer — the GCD.",
    tests: [
      { stdin: "12 18", expected: "6", sample: true },
      { stdin: "100 75", expected: "25", sample: true },
      { stdin: "7 13", expected: "1", sample: false },
      { stdin: "5 5", expected: "5", sample: false },
      { stdin: "1 999", expected: "1", sample: false },
    ],
  },

  "is-prime": {
    id: "is-prime",
    title: "Prime number",
    statement: "You're given an integer n (n ≥ 1). Print yes if n is prime, otherwise no.",
    ioSpec: "Input: a single integer n.\nOutput: yes or no.",
    tests: [
      { stdin: "7", expected: "yes", sample: true },
      { stdin: "10", expected: "no", sample: true },
      { stdin: "1", expected: "no", sample: false },
      { stdin: "2", expected: "yes", sample: false },
      { stdin: "97", expected: "yes", sample: false },
      { stdin: "100", expected: "no", sample: false },
    ],
  },

  "count-vowels": {
    id: "count-vowels",
    title: "Vowel count",
    statement: "You're given a string of Latin letters. Count the vowels (a, e, i, o, u), case-insensitive.",
    ioSpec: "Input: one line.\nOutput: a single integer — the number of vowels.",
    tests: [
      { stdin: "hello", expected: "2", sample: true },
      { stdin: "aeiou", expected: "5", sample: true },
      { stdin: "xyz", expected: "0", sample: false },
      { stdin: "Programming", expected: "3", sample: false },
      { stdin: "bbb", expected: "0", sample: false },
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
