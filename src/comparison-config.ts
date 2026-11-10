// Scenarios left out of the comparison (comparison.config.json at the project root). An excluded scenario isn't run
// through the calculator, explained or documented: the runner, `explain` and the scenario docs skip it, and the findings
// document lists it with its reason. The neutral tools still cover it. Rules:
//   { "test": "ManureManagement.Pigs", "scenario": "Default scenario", "calculators": ["Acme"], "reason": "..." }   (names or ids)
// `test` and `scenario` are exact names with * as a wildcard; no `scenario` excludes the whole test (the only way for a
// test without named scenarios); no `calculators` applies to every calculator. `reason` is required.
import fs from "node:fs";
import path from "node:path";
import { calculator } from "./calculators";
import { inWorkspace } from "./workspace";
import { idOf } from "./calculators/config";
import { findTest, loadCases } from "./fixtures";

export type ExclusionRule = { test: string; scenario?: string; calculators?: string[]; reason: string };

export const CONFIG_FILE = inWorkspace("comparison.config.json");

const wildcard = (pattern: string) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);

let rules: (ExclusionRule & { testRe: RegExp; scenarioRe?: RegExp })[] | undefined;
const loadRules = () => {
  if (rules) return rules;
  const config = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) : { exclude: [] };
  rules = (config.exclude ?? []).map((r: ExclusionRule, i: number) => {
    if (!r.test || !r.reason) throw new Error(`${path.basename(CONFIG_FILE)}: exclude[${i}] needs "test" and "reason"`);
    return { ...r, testRe: wildcard(r.test), ...(r.scenario !== undefined ? { scenarioRe: wildcard(r.scenario) } : {}) };
  });
  return rules!;
};

/** The rule excluding a scenario from this run's calculator comparison, if any ("" or undefined: a test without scenarios). */
export const exclusion = (test: string, scenario: string | undefined): ExclusionRule | undefined =>
  loadRules().find(
    (r) =>
      (!r.calculators || r.calculators.some((c) => c === calculator().id || idOf(c) === calculator().id)) &&
      r.testRe.test(test) &&
      (!r.scenarioRe || r.scenarioRe.test(scenario ?? "")),
  );

export const isExcluded = (test: string, scenario: string | undefined) => !!exclusion(test, scenario);

/**
 * Every scenario this run's calculator excludes, across the given tests, and the rules that match none (a typo, or a
 * scenario that no longer exists).
 */
export const exclusions = (tests: string[]) => {
  const matched: { test: string; scenario: string | undefined; reason: string }[] = [];
  const used = new Set<ExclusionRule>();
  for (const test of tests) {
    const entry = findTest(test);
    if (!entry?.TestInputFile) continue;
    for (const c of loadCases(entry)) {
      const r = exclusion(test, c.name);
      if (!r) continue;
      matched.push({ test, scenario: c.name, reason: r.reason });
      used.add(r);
    }
  }
  const unmatched = loadRules().filter((r) => (!r.calculators || r.calculators.some((c) => c === calculator().id || idOf(c) === calculator().id)) && !used.has(r));
  return { matched, unmatched };
};

const START = "<!-- exclusions:start (generated from comparison.config.json by npm run docs:scenarios; don't edit) -->";
const END = "<!-- exclusions:end -->";

/**
 * Rewrites the excluded-scenarios list in the calculator's findings document, between the START and END markers (left
 * alone when the document has no markers). Lists the scenarios and reasons only: their results aren't compared.
 */
export const writeFindingsExclusions = (tests: string[]) => {
  const file = inWorkspace(calculator().findings);
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  const a = text.indexOf(START.slice(0, 22));
  const b = text.indexOf(END);
  if (a < 0 || b < a) return;
  const { matched } = exclusions(tests);
  const body = matched.length
    ? [
        `${matched.length} scenario(s) are excluded from the ${calculator().name} comparison (their results aren't counted):`,
        "",
        "| Test | Scenario | Reason |",
        "|---|---|---|",
        ...matched.map((m) => `| ${m.test} | ${m.scenario ?? "(whole test)"} | ${m.reason} |`),
      ]
    : ["No scenarios are excluded."];
  const next = `${text.slice(0, a)}${START}\n${body.join("\n")}\n${text.slice(b)}`;
  if (next !== text) fs.writeFileSync(file, next);
};

/** Warns (once per process) about rules that exclude nothing. */
let warned = false;
export const warnUnmatched = (tests: string[]) => {
  if (warned) return;
  warned = true;
  for (const r of exclusions(tests).unmatched)
    console.warn(`${path.basename(CONFIG_FILE)}: no scenario matches { test: "${r.test}"${r.scenario !== undefined ? `, scenario: "${r.scenario}"` : ""} }`);
};
