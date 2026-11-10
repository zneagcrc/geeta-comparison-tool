// Neutral scenario tools, for every module in src/neutral/registry.ts.
//   npx geeta-compare neutral export [Test ...]            write scenarios/<module>/<scenario>.json for each fixture scenario
//   npx geeta-compare neutral check [Test ...]             round-trip every fixture scenario and report
//   npx geeta-compare neutral to-veerg <neutral.json>      print the workbook test scenario for a neutral scenario
//   npx geeta-compare neutral run <neutral.json>           print the calculator's results for a neutral scenario
//                                                             (--calculator <id>)
// With no tests given, export and check cover every registered module.
import fs from "node:fs";
import path from "node:path";
import { findTest, loadCases } from "../fixtures";
import { MODULES, type NeutralModule, moduleFor, moduleForScenario } from "./registry";
import { calculator } from "../calculators";
import { WORKSPACE } from "../workspace";

const ROOT = WORKSPACE;
const [command, ...args] = process.argv.slice(2);

/** JSON with sorted keys, so structurally equal objects compare equal. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));

const fileName = (name: string) => `${name.replace(/[^A-Za-z0-9._-]+/g, "_")}.json`;

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

/** Fixture cells/fields that differ in meaning between two workbook scenarios (percent strings compared as numbers). */
const fixtureDiffs = (a: any, b: any) => {
  const value = (v: unknown) => (typeof v === "string" && /^-?[\d.]+\s*%$/.test(v.trim()) ? Number((parseFloat(v) / 100).toFixed(10)) : v);
  const flatten = (s: any) => {
    const out = new Map<string, unknown>();
    for (const [k, v] of Object.entries(s)) if (k.startsWith("X_Cell_")) out.set(k, v ?? "");
    for (const t of s.InputTables ?? [])
      for (const [col, fields] of Object.entries<any>(t.Cols ?? t.Rows ?? {}))
        for (const [field, v] of Object.entries<any>(fields ?? {}))
          if (v !== null && v !== undefined && v !== "") out.set(`${t.TableName}.${col}.${field}`, value(v));
    return out;
  };
  const fa = flatten(a);
  const fb = flatten(b);
  const keys = new Set([...fa.keys(), ...fb.keys()]);
  return [...keys].filter((k) => canonical(fa.get(k) ?? null) !== canonical(fb.get(k) ?? null)).map((k) => ({ field: k, original: fa.get(k), generated: fb.get(k) }));
};

const selected = (names: string[]): NeutralModule[] =>
  names.length
    ? names.map((n) => {
        const m = moduleFor(n);
        if (!m) throw new Error(`No neutral format for ${n} (registered: ${MODULES.map((x) => x.test).join(", ")})`);
        return m;
      })
    : // Every module the GEETA test set has a test for (a release can leave some out)
      MODULES.filter((m) => {
        if (findTest(m.test)) return true;
        console.log(`${m.test}: not in this GEETA test set, skipped`);
        return false;
      });

if (command === "export") {
  for (const m of selected(args)) {
    const out = path.join(ROOT, "scenarios", m.folder);
    fs.mkdirSync(out, { recursive: true });
    const cases = loadCases(findTest(m.test));
    for (const { name, input } of cases)
      fs.writeFileSync(path.join(out, fileName(name ?? m.test)), JSON.stringify(m.fromVeerg(input), null, 2) + "\n");
    console.log(`${m.test}: ${cases.length} scenario(s) -> scenarios/${m.folder}`);
  }
} else if (command === "check") {
  let problems = 0;
  for (const m of selected(args)) {
    for (const { name, input } of loadCases(findTest(m.test))) {
      const label = `${m.test}${name ? ` / ${name}` : ""}`;
      try {
        const neutral = m.fromVeerg(input);
        const generated = m.toVeerg(neutral);
        const again = m.fromVeerg(generated);
        const lossless = canonical(neutral) === canonical(again);
        // The calculator's results from the neutral scenario must be the same before and after the round trip
        const results = calculator().neutralResults?.[m.test];
        const sameResults = !results || canonical(quiet(() => results(neutral))) === canonical(quiet(() => results(again)));
        const diffs = fixtureDiffs(input, generated).filter((d) => !m.ignore?.(d.field, input, neutral));
        const ok = lossless && sameResults && !diffs.length;
        if (!ok) problems++;
        console.log(
          `${ok ? "OK  " : "FAIL"} ${label}: round trip ${lossless ? "lossless" : "LOSSY"}, results ${sameResults ? "identical" : "DIFFER"}, ${diffs.length} fixture field(s) written differently`,
        );
        for (const d of diffs.slice(0, 6)) console.log(`       ${d.field}: ${JSON.stringify(d.original)} -> ${JSON.stringify(d.generated)}`);
        if (diffs.length > 6) console.log(`       ... ${diffs.length - 6} more`);
      } catch (e: any) {
        problems++;
        console.log(`FAIL ${label}: ${String(e?.message ?? e).slice(0, 400)}`);
      }
    }
  }
  console.log(problems ? `\n${problems} scenario(s) failed` : "\nAll scenarios round-trip");
  process.exitCode = problems ? 1 : 0;
} else if (command === "to-veerg" || command === "run") {
  const scenario = JSON.parse(fs.readFileSync(args[0], "utf8"));
  const m = moduleForScenario(scenario);
  if (!m) throw new Error(`No module for section "${scenario.section}"`);
  const results = calculator().neutralResults?.[m.test];
  if (command === "run" && !results) throw new Error(`${calculator().name} has no neutral entry point for ${m.test}`);
  console.log(JSON.stringify(command === "to-veerg" ? m.toVeerg(scenario) : results!(scenario), null, 2));
} else {
  console.log("usage: cli.ts export [Test ...] | check [Test ...] | to-veerg <neutral.json> | run <neutral.json>");
}
