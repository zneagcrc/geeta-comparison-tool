// The explanation store: every explanation ever recorded for a difference between a calculator and GEETA, one JSON file
// per test in explanations/<calculator id>/. Records are only ever added (by `npm run explain -- add`), never edited or removed, so the
// history stays. For a given result the shown explanation is the most specific matching record that hasn't been
// superseded, newest first.
//
// Each record holds the evidence fingerprints of the scenarios it was written against. When a scenario's inputs,
// GEETA values, calculator values or the calculator version change, its fingerprint changes and the explanation shows
// as stale.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CheckSpec } from "./checks";
import { calculator } from "../calculators";
import { inWorkspace } from "../workspace";

/** This calculator's explanations (explanations/<id>/). */
export const storeDir = () => inWorkspace("explanations", calculator().id);

/** Kinds of difference; the first two name the calculator ("<name> defect", "<name> coverage gap"). */
export const differenceTypes = () => [
  `${calculator().name} defect`,
  `${calculator().name} coverage gap`,
  "Method difference",
  "Data version",
  "Constant convention",
  "Workbook defect",
  "Adapter defect",
  "Other",
];
export type DifferenceType = string;

export type ExplanationRecord = {
  id: string;
  /** ISO timestamp. */
  created: string;
  /** Who wrote the text: an LLM (with the model id) or a person. */
  author: { kind: "llm"; model: string } | { kind: "human"; name?: string };
  /** Where it came from, e.g. "migrated from an earlier list". */
  origin?: string;
  /** Section in the calculator's findings document (Calculator.findings). */
  section?: string;
  type: DifferenceType;
  /** Regular expressions (source text) for the scenario and result names it covers; absent = all. */
  scope: { scenario?: string; result?: string };
  note: string;
  /** What the explanation relies on: methodology document (version) and clause or table, calculator file, workbook cell, ... */
  sources?: string[];
  check?: CheckSpec;
  /** Scenario name ("" for tests without scenarios) -> evidence fingerprint when the record was written. */
  evidence: Record<string, string>;
  /** Ids of records this one replaces. */
  supersedes?: string[];
};

export type TestStore = { test: string; records: ExplanationRecord[] };

export const storeFile = (test: string) => path.join(storeDir(), `${test}.json`);

const cache = new Map<string, TestStore>();
export const loadStore = (test: string): TestStore => {
  if (!cache.has(test)) {
    const file = storeFile(test);
    cache.set(test, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { test, records: [] });
  }
  return cache.get(test)!;
};

export const saveStore = (store: TestStore) => {
  fs.mkdirSync(storeDir(), { recursive: true });
  fs.writeFileSync(storeFile(store.test), JSON.stringify(store, null, 2) + "\n");
  cache.set(store.test, store);
};

export const matches = (r: ExplanationRecord, scenario: string | undefined, result: string) =>
  (!r.scope.scenario || new RegExp(r.scope.scenario).test(scenario ?? "")) && (!r.scope.result || new RegExp(r.scope.result).test(result));

const specificity = (r: ExplanationRecord) => (r.scope.scenario ? 1 : 0) + (r.scope.result ? 1 : 0);

/** The explanation to show for a result: most specific, then newest, among records not superseded. */
export const selectRecord = (test: string, scenario: string | undefined, result: string): ExplanationRecord | undefined => {
  const { records } = loadStore(test);
  const superseded = new Set(records.flatMap((r) => r.supersedes ?? []));
  return records
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !superseded.has(r.id) && matches(r, scenario, result))
    .sort((a, b) => specificity(b.r) - specificity(a.r) || b.r.created.localeCompare(a.r.created) || b.i - a.i)[0]?.r;
};

/** All records for a test that match a result, newest first, including superseded ones (the history). */
export const history = (test: string, scenario: string | undefined, result: string) =>
  loadStore(test).records.filter((r) => matches(r, scenario, result)).sort((a, b) => b.created.localeCompare(a.created));

/** Canonical JSON: sorted keys, numbers to 12 significant figures (so float noise doesn't change the hash). */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    typeof x === "number"
      ? Number(x.toPrecision(12))
      : x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
        : x,
  );

/**
 * Evidence fingerprint for one scenario: resolved inputs, GEETA results, calculator results (incl. probes) and the
 * calculator's version, keyed by its id (so a fingerprint stays the same as long as the calculator's id, version and evidence do).
 */
export const fingerprint = (input: unknown, expected: unknown, actual: unknown) =>
  crypto
    .createHash("sha256")
    .update(canonical({ [calculator().id]: calculator().version(), input, expected, actual }))
    .digest("hex")
    .slice(0, 16);
