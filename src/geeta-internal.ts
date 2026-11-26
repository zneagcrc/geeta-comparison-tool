// GEETA-internal results and scenarios: those a TestResults file's top-level "GeetaInternalResults" block marks as used
// only inside GEETA, not for comparison by calculator providers (GAF-VEERG-Functions SCRIPTS.md, "GEETA-internal results
// and scenarios"). Each entry:
//   { "Scenarios": "*" | "<name>" | ["<name>", ...], "Results": "*" | { "<result name>": "<reason>", ... }, "Reason"?: "..." }
// "Results": "*" makes the matched scenarios internal as a whole ("Reason", if given, says why). Scenario names match
// regardless of case; a flagged scenario doesn't make the scenarios that extend it internal; a file without named
// scenarios matches "*" entries only. Mirrors Get-GeetaInternal in GEETA's create-test-excel-from-json.ps1 and
// scenario-lib.ps1: keep them in step.
//
// By default a run leaves them out: they aren't compared, explained or counted, and the docs show them greyed. With
// "compareGeetaInternal": true in comparison.config.json, --geeta-internal on a command, or GEETA_INTERNAL=1, they are
// compared and explained like any other result, but counted separately: never in the main totals or the exit code.
// --no-geeta-internal (or GEETA_INTERNAL=0) turns it off for one run. `test`, `explain` and `docs` follow it.
import fs from "node:fs";
import { inWorkspace } from "./workspace";

export const BLOCK = "GeetaInternalResults";

export type GeetaInternal = {
  /** The whole scenario is internal. */
  scenario: boolean;
  /** Why the whole scenario is (the entry's "Reason"), if GEETA says. */
  reason?: string;
  /** Internal results of the scenario: name -> reason. */
  results: Record<string, string>;
};

export const NOT_INTERNAL: GeetaInternal = Object.freeze({ scenario: false, results: Object.freeze({}) }) as GeetaInternal;

const names = (v: unknown): string[] => (Array.isArray(v) ? v : [v]).filter((s) => s !== undefined && s !== null).map(String);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The block's entries, with the problems GEETA's own check reports (malformed entries are skipped). */
const entries = (resultsFile: any) => {
  const problems: string[] = [];
  const ok: { scenarios: string[]; results: "*" | Record<string, string>; reason?: string }[] = [];
  const block = resultsFile?.[BLOCK];
  if (block === undefined) return { ok, problems };
  (Array.isArray(block) ? block : [block]).forEach((e: any, n) => {
    const i = n + 1;
    if (!isObject(e) || !("Scenarios" in e) || !("Results" in e)) return void problems.push(`entry ${i} needs both "Scenarios" and "Results"`);
    const scenarios = names(e.Scenarios);
    if (!scenarios.length) return void problems.push(`entry ${i}: "Scenarios" is empty (use "*" for every scenario)`);
    const reason = typeof e.Reason === "string" && e.Reason.trim() ? e.Reason.trim() : undefined;
    if (e.Results === "*") return void ok.push({ scenarios, results: "*", reason });
    if (isObject(e.Results)) {
      if (!Object.keys(e.Results).length) return void problems.push(`entry ${i}: "Results" is empty (use "*" for the whole scenario)`);
      return void ok.push({ scenarios, results: Object.fromEntries(Object.entries(e.Results).map(([k, v]) => [k, String(v ?? "")])), reason });
    }
    problems.push(`entry ${i}: "Results" must be "*" or an object of result name -> reason`);
  });
  return { ok, problems };
};

const applies = (scenarios: string[], name: string | undefined) =>
  scenarios.includes("*") || (!!name && scenarios.some((s) => s.toLowerCase() === name.toLowerCase()));

/** What a results file marks internal for one scenario (undefined: a file without named scenarios). */
export const geetaInternalOf = (resultsFile: any, scenario: string | undefined): GeetaInternal => {
  const { ok } = entries(resultsFile);
  if (!ok.length) return NOT_INTERNAL;
  const out: GeetaInternal = { scenario: false, results: {} };
  for (const e of ok) {
    if (!applies(e.scenarios, scenario)) continue;
    if (e.results === "*") {
      out.scenario = true;
      out.reason ??= e.reason;
    } else Object.assign(out.results, e.results);
  }
  return out;
};

/**
 * Problems with a results file's block, as GEETA's check reports them: malformed entries, scenario names the file
 * doesn't have, and result names no scenario has.
 */
export const geetaInternalProblems = (resultsFile: any): string[] => {
  const { ok, problems } = entries(resultsFile);
  const scenarios: any[] | undefined = resultsFile?.Scenarios;
  const known = new Set((scenarios ?? []).map((s) => String(s?.ScenarioName ?? "").toLowerCase()));
  const results = new Set(scenarios ? scenarios.flatMap((s) => Object.keys(s ?? {})) : Object.keys(resultsFile ?? {}));
  for (const e of ok) {
    for (const s of e.scenarios) if (s !== "*" && !known.has(s.toLowerCase())) problems.push(`names scenario "${s}", which isn't in this results file`);
    if (e.results !== "*") for (const r of Object.keys(e.results)) if (!results.has(r)) problems.push(`flags "${r}", which no scenario has as a result`);
  }
  return problems;
};

/** Whether a result of a scenario is GEETA internal. */
export const isInternal = (internal: GeetaInternal, result: string) => internal.scenario || result in internal.results;

/** Why a result is internal, or undefined when it isn't. */
export const internalReason = (internal: GeetaInternal, result: string): string | undefined =>
  internal.results[result] || (internal.scenario ? internal.reason ?? "The whole scenario is GEETA internal" : result in internal.results ? "GEETA internal" : undefined);

// --- the run setting ------------------------------------------------------------

// Taken off the command line (commands read their arguments as test names), and passed on to worker processes
for (const [flag, value] of [
  ["--geeta-internal", "1"],
  ["--no-geeta-internal", "0"],
] as const)
  while (process.argv.includes(flag)) {
    process.argv.splice(process.argv.indexOf(flag), 1);
    process.env.GEETA_INTERNAL = value;
  }

let fromConfig: boolean | undefined;
const configSays = () => {
  if (fromConfig === undefined) {
    const file = inWorkspace("comparison.config.json");
    try {
      fromConfig = fs.existsSync(file) && JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")).compareGeetaInternal === true;
    } catch {
      fromConfig = false;
    }
  }
  return fromConfig;
};

/** Whether this run compares GEETA-internal results (counted separately) rather than leaving them out. */
export const compareGeetaInternal = () => (process.env.GEETA_INTERNAL ? process.env.GEETA_INTERNAL !== "0" : configSays());

/** Whether this run leaves a result out: it's internal and internal results aren't compared. */
export const leftOut = (internal: GeetaInternal, result: string) => !compareGeetaInternal() && isInternal(internal, result);

/** For run headers: "" unless GEETA-internal results are compared. */
export const internalNote = () =>
  compareGeetaInternal()
    ? ` (GEETA-internal results compared too, counted separately: ${process.env.GEETA_INTERNAL ? "--geeta-internal or GEETA_INTERNAL" : "compareGeetaInternal in comparison.config.json"})`
    : "";
