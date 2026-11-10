// Regression baseline for moving adapters onto neutral scenarios: every adapter's output (results and probes) for every
// fixture scenario, so a rewritten adapter can be shown to give exactly the same numbers.
//   npx geeta-compare baseline save [Test ...]      write src/calculators/<id>/baseline.json (or update those tests)
//   npx geeta-compare baseline compare [Test ...]   compare current adapter output with the saved baseline
import fs from "node:fs";
import path from "node:path";
import { calculator } from "../calculators";
import { inWorkspace } from "../workspace";
import { findTest, loadCases } from "../fixtures";

const { adapters, adapterDir } = calculator();
const FILE = inWorkspace(adapterDir, "../baseline.json");
const [command, ...only] = process.argv.slice(2);

const quiet = <T>(fn: () => T): T => {
  const { log, warn } = console;
  console.log = console.warn = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
};

/** Adapter output for every scenario of a test, keyed by scenario name ("" for tests without scenarios). */
const snapshot = (test: string) =>
  Object.fromEntries(
    loadCases(findTest(test)).map((c) => {
      try {
        return [c.name ?? "", quiet(() => adapters[test](c.input))];
      } catch (e: any) {
        return [c.name ?? "", { ERROR: String(e?.message ?? e) }];
      }
    }),
  );

const same = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" ? a === b || Math.abs(a - b) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b)) : JSON.stringify(a) === JSON.stringify(b);

const tests = only.length ? only : Object.keys(adapters);
if (command === "save") {
  const saved = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
  for (const t of tests) saved[t] = snapshot(t);
  fs.writeFileSync(FILE, JSON.stringify(saved, null, 1) + "\n");
  console.log(`Saved baseline for ${tests.length} test(s)`);
} else if (command === "compare") {
  const saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
  let bad = 0;
  for (const t of tests) {
    const now = snapshot(t);
    const diffs: string[] = [];
    for (const sc of new Set([...Object.keys(saved[t] ?? {}), ...Object.keys(now)]))
      for (const k of new Set([...Object.keys(saved[t]?.[sc] ?? {}), ...Object.keys(now[sc] ?? {})]))
        if (!same(saved[t]?.[sc]?.[k], now[sc]?.[k])) diffs.push(`${sc || "(no scenarios)"} ${k}: ${JSON.stringify(saved[t]?.[sc]?.[k])} -> ${JSON.stringify(now[sc]?.[k])}`);
    if (diffs.length) bad++;
    console.log(`${diffs.length ? "DIFF" : "same"}  ${t}${diffs.length ? `: ${diffs.length} value(s)` : ""}`);
    for (const d of diffs.slice(0, 5)) console.log(`      ${d}`);
  }
  process.exitCode = bad ? 1 : 0;
} else console.log("usage: baseline.ts save|compare [Test ...]");
