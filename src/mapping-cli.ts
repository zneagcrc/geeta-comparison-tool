// geeta-compare mapping [Test ...] [--check]: the state of the calculator's mapping decisions (mapping.json, see
// src/mapping.ts). It runs every adapter over every scenario (as `test` does, without comparing) and reports, with no
// LLM involved:
//   - gaps: values and fields an adapter looked up that have no decision;
//   - options not decided: for a lookup table tied to a GEETA field ("geeta"), every option of that field with no entry,
//     whether or not a scenario uses it;
//   - proposals: decisions marked "proposed", waiting for the provider's review;
//   - unused decisions: entries no scenario reached (information only).
// --check exits 1 while there are gaps, undecided options or proposals.
import fs from "node:fs";
import path from "node:path";
import { calculator } from "./calculators";
import { findTest, loadCases } from "./fixtures";
import { isExcluded } from "./comparison-config";
import { type DecisionUse, decisionUses, mappingFileOf, readMapping, resetDecisionUses } from "./mapping";
import { GEETA } from "./geeta-source";
import { WORKSPACE } from "./workspace";

const args = process.argv.slice(2);
const check = args.includes("--check");
const requested = args.filter((a) => !a.startsWith("--"));
const calc = calculator();
const file = mappingFileOf(calc.id);
const decisions = readMapping(calc.id);
const rel = (p: string) => path.relative(WORKSPACE, p).replace(/\\/g, "/");

// --- run every adapter, collecting the decisions each scenario used ---------------------------------------------------
type Use = DecisionUse & { where: string };
const uses: Use[] = [];
const errors: string[] = [];
for (const name of requested.length ? requested : Object.keys(calc.adapters)) {
  const adapter = calc.adapters[name];
  const test = findTest(name);
  if (!adapter || !test?.TestInputFile) {
    console.log(`${name}: ${!adapter ? "no adapter" : "not in Test.json"}, skipped`);
    continue;
  }
  for (const { name: scenario, input } of loadCases(test)) {
    if (isExcluded(name, scenario)) continue;
    resetDecisionUses();
    const { log, warn } = console;
    console.log = console.warn = () => {};
    try {
      adapter(input);
    } catch (e) {
      errors.push(`${name}${scenario ? `:${scenario}` : ""}: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
    } finally {
      console.log = log;
      console.warn = warn;
    }
    for (const u of decisionUses()) uses.push({ ...u, where: `${name}${scenario ? `:${scenario}` : ""}` });
  }
}

// --- the GEETA options of a field, from the release's InputFields --------------------------------------------------
const flatten = (options: unknown): string[] =>
  !options || typeof options !== "object"
    ? []
    : Object.entries(options as Record<string, unknown>).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v) : [k]));
let inputFields: any[] | undefined;
const geetaOptions = (ref: string): string[] | undefined => {
  inputFields ??= (() => {
    const dir = path.join(GEETA.dir, "InputFields");
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) : [];
  })();
  // A field whose options depend on another (DependentOn, e.g. the fuel types for one fuel use) takes the parent value in
  // brackets: "Table_Input_Fuel.FuelType[Generators]". Without one, the options of every parent value are checked.
  const m = ref.match(/^(.*?)(?:\[(.+)\])?$/)!;
  const [table, column] = m[1].split(".");
  const parent = m[2];
  const options = (field: any) => (parent !== undefined ? (field?.DependentOn ? field.Options?.[parent] : undefined) : field?.Options);
  const found = new Set<string>();
  for (const doc of inputFields) {
    if (!column) for (const c of doc.InputCells ?? []) if (c.CellName === table) flatten(options(c)).forEach((o) => found.add(o));
    if (column)
      for (const t of doc.InputTables ?? [])
        if (t.TableName === table)
          for (const part of [t.Rows, t.Cols]) for (const fields of Object.values<any>(part ?? {})) flatten(options(fields?.[column])).forEach((o) => found.add(o));
  }
  return found.size ? [...found] : undefined;
};

// --- report -------------------------------------------------------------------------------------------------------
const out: string[] = [];
let open = 0;
const section = (title: string, lines: string[]) => {
  if (!lines.length) return;
  out.push("", title, ...lines.map((l) => `  ${l}`));
};

const gapKey = (u: Use) => `${u.kind} ${u.key}${u.value !== undefined ? ` = "${u.value}"` : ""}`;
const gaps = new Map<string, string[]>();
for (const u of uses.filter((x) => x.gap)) gaps.set(gapKey(u), [...(gaps.get(gapKey(u)) ?? []), u.where]);
open += gaps.size;
section(
  `No decision (${gaps.size}): adapters asked for these and found nothing, so the input was left out`,
  [...gaps].map(([k, where]) => `${k}   in ${where.slice(0, 3).join(", ")}${where.length > 3 ? ` and ${where.length - 3} more` : ""}`),
);

const undecided: string[] = [];
for (const [table, t] of Object.entries(decisions.lookups ?? {})) {
  if (!t.geeta) continue;
  const options = geetaOptions(t.geeta);
  if (!options) {
    undecided.push(`${table}: GEETA field ${t.geeta} not found in the release's InputFields`);
    continue;
  }
  const missing = options.filter((o) => !(o in (t.values ?? {})));
  if (missing.length) undecided.push(`${table} (${t.geeta}): ${missing.map((m) => `"${m}"`).join(", ")}`);
  open += missing.length;
}
section("GEETA options with no decision (whether or not a scenario uses them)", undecided);

const proposals: string[] = [];
for (const [table, t] of Object.entries(decisions.lookups ?? {}))
  for (const [v, e] of Object.entries(t.values ?? {})) if (e.by === "proposed") proposals.push(`lookup ${table} = "${v}" -> ${JSON.stringify(e.to)}${e.reason ? `: ${e.reason}` : ""}`);
for (const [f, e] of Object.entries(decisions.defaults ?? {})) if (e.by === "proposed") proposals.push(`default ${f} = ${JSON.stringify(e.value)}${e.reason ? `: ${e.reason}` : ""}`);
for (const [k, e] of Object.entries(decisions.assumptions ?? {})) if (e.by === "proposed") proposals.push(`assumption ${k}: ${e.reading}${e.reason ? ` (${e.reason})` : ""}`);
open += proposals.length;
section(`Proposed, waiting for review (${proposals.length}): keep (set "by": "provider"), change or remove each`, proposals);

const reached = new Set(uses.filter((u) => !u.gap).map((u) => `${u.kind} ${u.key}${u.value !== undefined ? ` ${u.value}` : ""}`));
const unused: string[] = [];
for (const [table, t] of Object.entries(decisions.lookups ?? {}))
  for (const v of Object.keys(t.values ?? {})) if (!reached.has(`lookup ${table} ${v}`)) unused.push(`lookup ${table} = "${v}"`);
for (const f of Object.keys(decisions.defaults ?? {})) if (!reached.has(`default ${f}`)) unused.push(`default ${f}`);
for (const k of Object.keys(decisions.assumptions ?? {})) if (!reached.has(`assumption ${k}`)) unused.push(`assumption ${k}`);
section(`Not reached by any scenario (${unused.length}; information only)`, unused);
section(`Adapter errors (${errors.length})`, errors);

console.log(`${calc.name} mapping decisions: ${rel(file)}${fs.existsSync(file) ? "" : " (doesn't exist yet)"}`);
console.log(`${uses.filter((u) => !u.gap).length} decision(s) used across the scenarios run.`);
console.log(out.length ? out.join("\n") : "\nNo gaps, undecided options or proposals.");
console.log("\nInputs an adapter drops without asking aren't listed here: check \"Not used by\" in the scenario docs' mapping table.");
if (check && (open || errors.length)) {
  console.log(`\nmapping --check: ${open} open decision(s)${errors.length ? `, ${errors.length} adapter error(s)` : ""}`);
  process.exitCode = 1;
}
