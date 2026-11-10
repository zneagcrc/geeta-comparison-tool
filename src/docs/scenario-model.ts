// Format-agnostic model of the GAF-VEERG test scenarios for the scenario docs (export.ts renders it as HTML and
// Markdown). Ported from GAF-VEERG-Functions scripts/scenario-doc-lib.ps1, with these changes:
//   - no Excel cell, table or result names: everything is shown by its InputFields label or a humanized name;
//   - results have three columns: NIR (hard-coded per scenario in the TestResults file, under "NIRResults"),
//     GEETA (the workbook's expected results) and the calculator compared (src/calculators, via its adapters).
import fs from "node:fs";
import path from "node:path";
import { TEST_DIR, mergeScenario, readJson } from "../fixtures";
import type { CheckResult } from "../explain/checks";
import { type Review, diagnoseCase } from "../explain/diagnose";
import type { Finding } from "../explain/findings";
import type { ExplanationRecord } from "../explain/store";
import { moduleFor } from "../neutral/registry";
import { type Mapping, scenarioMapping, traceStats } from "./mapping";
import { isExcluded } from "../comparison-config";
import { calculator } from "../calculators";
import { type InputCall, comparedResults } from "../calculators/types";
import { type DecisionUse, decisionUses, resetDecisionUses } from "../mapping";

const { adapters, captureInputs, name: calculatorName } = calculator();

export const INPUT_FIELDS_DIR = path.resolve(TEST_DIR, "../InputFields");

/** Scenario keys that aren't inputs or results. */
const META = new Set(["Scenarios", "ScenarioFiles", "ScenarioName", "ScenarioDescription", "ScenarioNotes", "ScenarioExtends", "FollowOnTests", "__FormulaOverwritePolicy", "InputTables", "NIRResults"]);

// Same tolerance as src/run-veerg-tests.ts
const REL_TOL = 1e-6;
const ABS_TOL = 1e-12;

// --- names -------------------------------------------------------------------

export const splitCamel = (t: string) =>
  t
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\bN2 O\b/g, "N2O") // keep the gas formula whole
    .replace(/\s+/g, " ")
    .trim();

/** X_Cell_Site_FarmName -> "Site Farm Name" (prefix dropped, words split). */
export const humanize = (name: string) => splitCamel(name.replace(/^(X_Cell_|X_Table_|Table_Input_)/, "").replace(/_/g, " "));

/** X_Cell_Site_FarmName -> "Farm Name" (prefix and sheet token dropped). */
export const humanizeMember = (name: string) => {
  const m = name.match(/^X_(?:Cell|Table)_[A-Za-z0-9]+_(.+)$/);
  return m ? splitCamel(m[1].replace(/_/g, " ")) : humanize(name);
};

/** VEERG_4_6_1_1__1_TotalAnnualMethaneEmissions_Result_Method1 -> "4.6.1.1 (1) Total Annual Methane Emissions: Method 1". */
export const humanizeResult = (name: string) => {
  if (!/^VEERG_/i.test(name)) return humanize(name);
  const s = name.slice(6);
  const rest = (r: string) =>
    splitCamel(
      r
        .replace(/_Result(?:_(.+?))?_Method(\d+)(_CO2e)?$/i, (_, part, n, co2e) => `${part ? `_${part}` : ""}: Method ${n}${co2e ? " (CO2e)" : ""}`)
        .replace(/_/g, " "),
    );
  const m = s.match(/^([0-9_]+?)__([0-9]+)_(.*)$/);
  if (m) return `${m[1].replace(/_/g, ".")} (${m[2]}) ${rest(m[3])}`;
  const m2 = s.match(/^([0-9_]+?)_([A-Za-z].*)$/);
  if (m2) return `${m2[1].replace(/_/g, ".")} ${rest(m2[2])}`;
  return splitCamel(s.replace(/_/g, " "));
};

/** Orders numeric runs numerically (4.3.1.2 before 4.3.1.10). */
export const naturalKey = (t: string) => t.replace(/\d+/g, (d) => d.padStart(9, "0"));

export const slug = (t: string) => t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "scenario";

/** NIRAlignment_4_3_ManureManagement_Dairy_01 -> "4.3 ManureManagement Dairy 01". */
export const formatScenarioTitle = (t: string) => t.replace(/^NIRAlignment_/, "").replace(/(?<=\d)_(?=\d)/g, ".").replace(/_/g, " ");

const sheetOf = (name: string) => name.match(/^X_(?:Cell|Table)_([A-Za-z0-9]+)_/)?.[1];

// --- InputFields labels --------------------------------------------------------

type Labels = {
  cell: Map<string, { label?: string; unit?: string }>;
  /** Per table: column (ColumnNames) labels and field labels. */
  table: Map<string, { columns: Record<string, string>; fields: Record<string, { label?: string; unit?: string }> }>;
};

const inputFieldsBaseName = (excelFile: string) => {
  let b = excelFile.replace(/\.xlsx?$/i, "").replace(/_WIP_v\d+$/i, "").replace(/_(Template|Clean)$/i, "");
  if (/^Enterprise_/i.test(b)) return b;
  return b.replace(/^\d+(?:_\d+)?_/, "");
};

const loadLabels = (excelFile: string | undefined): Labels => {
  const labels: Labels = { cell: new Map(), table: new Map() };
  const files = ["Common_InputFields.json", ...(excelFile ? [`${inputFieldsBaseName(excelFile)}_InputFields.json`] : [])];
  for (const file of files) {
    const p = path.join(INPUT_FIELDS_DIR, file);
    if (!fs.existsSync(p)) continue;
    const def = JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
    for (const c of def.InputCells ?? [])
      if (c?.CellName && !labels.cell.has(c.CellName)) labels.cell.set(c.CellName, { label: c.Label, unit: c.Unit });
    for (const t of def.InputTables ?? []) {
      if (!t?.TableName || labels.table.has(t.TableName)) continue;
      const fields: Record<string, { label?: string; unit?: string }> = {};
      for (const group of [t.Cols, t.Rows])
        for (const defs of Object.values<any>(group ?? {}))
          for (const [field, d] of Object.entries<any>(defs ?? {}))
            if (d && typeof d === "object" && (d.Label || d.Unit)) fields[field] ??= { label: d.Label, unit: d.Unit };
      labels.table.set(t.TableName, { columns: t.ColumnNames ?? {}, fields });
    }
  }
  return labels;
};

const withUnit = (label: string, unit?: string) => (unit && !label.endsWith(`(${unit})`) ? `${label} (${unit})` : label);

// --- scenario resolution (mirrors scripts/scenario-lib.ps1) ------------------------

const sameName = (a: unknown, b: unknown) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();

/** Inline Scenarios plus ScenarioFiles parts (an array or a { Scenarios } part is flattened in). */
const loadScenarios = (file: string, obj: any): any[] | undefined => {
  if (!obj.Scenarios && !obj.ScenarioFiles) return undefined;
  const list = [...(obj.Scenarios ?? [])];
  for (const ref of obj.ScenarioFiles ?? []) {
    const part = readJson(path.join(path.dirname(file), ref));
    list.push(...(Array.isArray(part) ? part : (part.Scenarios ?? [part])));
  }
  return list;
};

/** The scenario a scenario inherits from: explicit ScenarioExtends, else (legacy) the first scenario. */
const parentName = (scenarios: any[], s: any): string | undefined => {
  if ("ScenarioExtends" in s) return s.ScenarioExtends || undefined;
  return s === scenarios[0] ? undefined : scenarios[0]?.ScenarioName;
};

const resolve = (scenarios: any[], s: any, seen = new Set<string>()): any => {
  const parent = parentName(scenarios, s);
  if (!parent) return structuredClone(s);
  if (seen.has(s.ScenarioName)) throw new Error(`Circular ScenarioExtends at ${s.ScenarioName}`);
  const base = scenarios.find((x) => sameName(x.ScenarioName, parent));
  if (!base) throw new Error(`${s.ScenarioName} extends unknown scenario ${parent}`);
  return mergeScenario(resolve(scenarios, base, new Set([...seen, s.ScenarioName])), s);
};

const select = (scenarios: any[] | undefined, flat: any, name: string | undefined) => {
  if (!scenarios) return flat;
  const s = name === undefined ? scenarios[0] : scenarios.find((x) => sameName(x.ScenarioName, name));
  return s ? resolve(scenarios, s) : undefined;
};

/** Rows/Cols -> ordered { row -> { field -> value } } (Cols tables come out transposed: rows are fields). */
const tableRows = (t: any): Map<string, Map<string, unknown>> => {
  const rows = new Map<string, Map<string, unknown>>();
  if (t.Rows) {
    const entries: [string, any][] = Array.isArray(t.Rows)
      ? t.Rows.map((r: any, i: number) => [r?.RowName ?? `Row${i + 1}`, r && "Value" in r && "RowName" in r ? r.Value : r])
      : Object.entries(t.Rows);
    for (const [rn, data] of entries) {
      if (!data) continue;
      rows.set(rn, new Map(Object.entries(data).filter(([k]) => k !== "RowName")));
    }
    return rows;
  }
  for (const [col, fields] of Object.entries<any>(t.Cols ?? {}))
    for (const [field, v] of Object.entries(fields ?? {})) {
      if (!rows.has(field)) rows.set(field, new Map());
      rows.get(field)!.set(col, v);
    }
  return rows;
};

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.trim());
const display = (v: unknown) => (isEmpty(v) ? "" : String(v));

/** A resolved input scenario flattened to "cell" / "table\trow\tfield" -> displayed text, for change marking. */
const basis = (input: any) => {
  const map = new Map<string, string>();
  if (!input) return map;
  for (const [k, v] of Object.entries(input)) if (!META.has(k)) map.set(k, display(v));
  for (const t of input.InputTables ?? [])
    for (const [rn, fields] of tableRows(t)) for (const [f, v] of fields) map.set(`${t.TableName}\t${rn}\t${f}`, display(v));
  return map;
};

// --- model -------------------------------------------------------------------

export type Value = { value: unknown; changed?: boolean };
export type CellRow = { label: string } & Value;
export type InputTable = { title: string; replace: boolean; headers: string[]; rows: { label: string; values: Value[] }[] };
export type InputGroup = { title: string; cells: CellRow[]; tables: InputTable[] };
export type ResultRow = {
  name: string;
  /** Whether the calculator is compared on this result (a partial, enterprise, adapter covers only the modules it maps). */
  compared: boolean;
  nir: Value;
  geeta: Value;
  calc: Value;
  /** NIR / the calculator differ from GEETA (outside the comparison tolerance). */
  nirDiffers: boolean;
  calcDiffers: boolean;
  /** Deterministic findings from the numbers alone (src/explain/findings.ts). */
  findings: Finding[];
  /** The stored explanation shown for this result (explanations/<calculator>/<test>.json); undefined when the calculator matches or none fits. */
  record?: ExplanationRecord;
  /** The explanation's numeric check (undefined when there is no explanation or it has no check). */
  check?: CheckResult;
  /** Whether the explanation was written against this scenario's current evidence. */
  review?: Review;
};
export type FollowOn = { test: string; rows: { field: string; value: string }[] };
export type ScenarioPage = {
  name: string | undefined;
  title: string;
  slug: string;
  isBase: boolean;
  description?: string;
  extends?: string;
  notes: string[];
  inputs: InputGroup[];
  /** The scenario in the neutral format (src/neutral), or why it couldn't be converted. */
  neutral?: { value?: unknown; error?: string };
  /** How each neutral input reaches GEETA and the calculator (src/docs/mapping.ts). */
  /** undefined: the test has no neutral format; null: not traced yet (docs --trace). */
  mapping?: Mapping | null;
  /** What the adapter gave the calculator (distinct calls, numeric-check runs excluded). */
  calcInputs: InputCall[];
  results: ResultRow[];
  /** "ok", or why the calculator has no results (no adapter, or the adapter's error). */
  calc: { status: "ok" | "none" | "error"; message?: string; notes: string[]; decisions: DecisionUse[] };
  followOns: FollowOn[];
};
export type TestModel = { id: string; group: string[]; key: string; missing: boolean; pages: ScenarioPage[] };

const notesOf = (raw: any): string[] => {
  const n = raw?.ScenarioNotes;
  if (!n) return [];
  if (typeof n === "string") return [n];
  return (Array.isArray(n) ? n : Object.values(n)).map(String).filter((x) => x.trim());
};

const close = (a: unknown, b: unknown) => {
  if (typeof a === "number" && typeof b === "number")
    return Math.abs(a - b) <= Math.max(ABS_TOL, REL_TOL * Math.max(Math.abs(a), Math.abs(b)));
  return display(a) === display(b);
};

/** Runs the adapter, capturing its console notes (what it couldn't map, alternative definitions, ...). */
const runCalculator = (
  key: string,
  input: any,
): { results?: Record<string, unknown>; status: ScenarioPage["calc"]["status"]; message?: string; notes: string[]; inputs: InputCall[]; decisions: DecisionUse[] } => {
  const adapter = adapters[key];
  if (!adapter) return { status: "none", message: `No ${calculatorName} adapter for this test yet`, notes: [], inputs: [], decisions: [] };
  const notes: string[] = [];
  // The mapping decisions (mapping.json) the adapter uses for this scenario
  resetDecisionUses();
  const decisions = () => [...decisionUses()];
  let inputs: InputCall[] = [];
  const { log, warn } = console;
  console.log = console.warn = (...args: unknown[]) => notes.push(args.map(String).join(" ").trim());
  try {
    const captured = captureInputs ? captureInputs(() => adapter(input)) : { result: adapter(input), inputs: [] };
    inputs = captured.inputs;
    return { results: captured.result, status: "ok", notes, inputs, decisions: decisions() };
  } catch (error: any) {
    const message = String(error?.issues ? JSON.stringify(error.issues.map((i: any) => i.message)) : (error?.message ?? error));
    return { status: "error", message: message.slice(0, 500), notes, inputs, decisions: decisions() };
  } finally {
    console.log = log;
    console.warn = warn;
  }
};

const inputGroups = (input: any, parent: Map<string, string> | undefined, labels: Labels): InputGroup[] => {
  const groups = new Map<string, InputGroup>();
  const group = (sheet: string | undefined) => {
    const title = sheet ? humanize(sheet) : "Other inputs";
    if (!groups.has(title)) groups.set(title, { title, cells: [], tables: [] });
    return groups.get(title)!;
  };
  const changed = (key: string, v: unknown) => !!parent && parent.get(key) !== display(v);

  for (const [name, value] of Object.entries(input)) {
    if (META.has(name)) continue;
    const l = labels.cell.get(name);
    group(sheetOf(name)).cells.push({ label: withUnit(l?.label || humanizeMember(name), l?.unit), value, changed: changed(name, value) });
  }
  for (const t of input.InputTables ?? []) {
    if (!t?.TableName) continue;
    const l = labels.table.get(t.TableName) ?? { columns: {}, fields: {} };
    const rows = tableRows(t);
    const columns = [...new Set([...rows.values()].flatMap((r) => [...r.keys()]))];
    // Cols tables are transposed (rows are fields); Rows tables have fields as columns
    const fieldLabel = (f: string) => withUnit(l.fields[f]?.label || humanize(f), l.fields[f]?.unit);
    const isCols = !t.Rows;
    group(t.SheetGrouping || sheetOf(t.TableName)).tables.push({
      title: humanizeMember(t.TableName),
      replace: !!t.Replace && String(t.Replace).toLowerCase() !== "false",
      headers: columns.map((c) => (isCols ? l.columns[c] || humanize(c) : l.columns[c] || fieldLabel(c))),
      rows: [...rows].map(([rn, fields]) => ({
        label: isCols ? fieldLabel(rn) : humanize(rn),
        values: columns.map((c) => ({ value: fields.get(c), changed: changed(`${t.TableName}\t${rn}\t${c}`, fields.get(c)) })),
      })),
    });
  }
  return [...groups.values()];
};

const resultRows = (
  expected: any,
  parentExpected: any,
  calc: Record<string, unknown> | undefined,
  test: string,
  scenario: string | undefined,
  input: unknown,
): ResultRow[] => {
  const geeta = Object.fromEntries(Object.entries(expected ?? {}).filter(([k]) => !META.has(k)));
  // Same diagnosis as the runner (same comparison, findings, stored explanations and fingerprints)
  const compared = adapters[test] ? comparedResults(adapters[test], geeta) : geeta;
  const diagnosis = calc ? diagnoseCase(test, scenario, input, compared, calc) : undefined;
  const nir: Record<string, unknown> = expected?.NIRResults ?? {};
  const parentGeeta = parentExpected ? Object.fromEntries(Object.entries(parentExpected).filter(([k]) => !META.has(k))) : undefined;
  const keys = [...new Set([...Object.keys(geeta), ...Object.keys(nir)])].sort((a, b) => (naturalKey(a) < naturalKey(b) ? -1 : 1));
  return keys.map((k) => {
    const g = geeta[k];
    const has = (o: Record<string, unknown> | undefined) => !!o && k in o && !isEmpty(o[k]);
    const d = diagnosis?.results[k];
    const calcDiffers = !!d?.differs;
    return {
      name: humanizeResult(k),
      compared: k in compared,
      nir: { value: nir[k], changed: !!parentExpected && display(parentExpected.NIRResults?.[k]) !== display(nir[k]) && has(nir) },
      geeta: { value: g, changed: !!parentGeeta && display(parentGeeta[k]) !== display(g) },
      calc: { value: calc?.[k] },
      nirDiffers: has(nir) && k in geeta && !close(nir[k], g),
      calcDiffers,
      findings: d?.findings ?? [],
      ...(calcDiffers ? { record: d!.record, check: d!.check, review: d!.review } : {}),
    };
  });
};

const followOns = (raw: any): FollowOn[] =>
  (raw?.FollowOnTests ?? []).filter(Boolean).map((fo: any) => {
    const rows: FollowOn["rows"] = [];
    if (fo.ScenarioName) rows.push({ field: "Scenario", value: formatScenarioTitle(String(fo.ScenarioName)) });
    for (const f of ["PassOnResults", "PassOnInputs", "ClearBaseInputs"])
      if (f in fo) rows.push({ field: splitCamel(f), value: Array.isArray(fo[f]) ? fo[f].map((x: string) => humanizeResult(humanizeMember(x))).join(", ") : String(fo[f]) });
    for (const [k, v] of Object.entries(fo.Inputs ?? {})) rows.push({ field: `Input: ${humanizeMember(k)}`, value: display(v) });
    for (const t of fo.InputTables ?? []) rows.push({ field: "Input table", value: `${humanizeMember(t.TableName)}${t.Replace ? " (replaces)" : ""}: ${tableRows(t).size} row(s)` });
    for (const [k, v] of Object.entries(fo.ExpectedResults ?? {})) rows.push({ field: `Expected: ${humanizeResult(k)}`, value: display(v) });
    return { test: String(fo.TestID ?? "(no TestID)"), rows };
  });

/** tests: names as `geeta-compare test` takes them ("Fuel", "ManureManagement.Pigs") or TestIDs ("8_Fuel"). */
export type PlanOptions = { tests?: string[]; modulesOnly?: boolean; enterprisesOnly?: boolean; scenarioPrefix?: string; trace?: boolean };

/** Walks Test.json and builds a page model per scenario, applying the filters. */
export const buildModel = (opts: PlanOptions = {}): TestModel[] => {
  const config = readJson("Test.json");
  const entries: { entry: any; group: string[] }[] = [];
  const collect = (node: any, group: string[]) => {
    if (!node || typeof node !== "object") return;
    if (node.TestID) return void entries.push({ entry: node, group });
    for (const [k, v] of Object.entries(node)) collect(v, [...group, k]);
  };
  collect(config.Tests, []);

  const wanted = opts.tests?.length ? new Set(opts.tests.map((t) => t.toLowerCase())) : undefined;
  if (wanted) {
    const known = new Set(entries.flatMap(({ entry, group }) => [String(entry.TestID).toLowerCase(), group.join(".").toLowerCase()]));
    const unknown = opts.tests!.filter((t) => !known.has(t.toLowerCase()));
    if (unknown.length)
      throw new Error(`No test called ${unknown.map((t) => `"${t}"`).join(", ")}. Use the names \`npx geeta-compare test\` shows, e.g. Fuel or ManureManagement.Pigs.`);
  }

  const models: TestModel[] = [];
  for (const { entry, group } of entries) {
    const id = String(entry.TestID);
    const isEnterprise = group[0] === "Enterprises";
    const key = group.join(".");
    if (wanted ? !wanted.has(id.toLowerCase()) && !wanted.has(key.toLowerCase()) : (opts.modulesOnly && isEnterprise) || (opts.enterprisesOnly && !isEnterprise)) continue;
    const started = Date.now();
    const before = { ...traceStats };
    const inputPath = path.join(TEST_DIR, entry.TestInputFile ?? "");
    if (!entry.TestInputFile || !fs.existsSync(inputPath)) {
      models.push({ id, group, key, missing: true, pages: [] });
      continue;
    }
    const inputObj = readJson(entry.TestInputFile);
    const scenarios = loadScenarios(entry.TestInputFile, inputObj);
    const resultsObj = entry.TestResultsFile && fs.existsSync(path.join(TEST_DIR, entry.TestResultsFile)) ? readJson(entry.TestResultsFile) : undefined;
    const resultScenarios = resultsObj?.Scenarios as any[] | undefined;
    const labels = loadLabels(entry.TestExcelFile);

    // Which scenarios to show: all, or those matching the prefix plus the base scenarios they build on
    const all: (string | undefined)[] = scenarios ? scenarios.map((s) => s.ScenarioName) : [undefined];
    let shown = all.map((name) => ({ name, isBase: false }));
    if (opts.scenarioPrefix && scenarios) {
      const pre = opts.scenarioPrefix.toLowerCase();
      const selected = new Set(all.filter((n) => String(n).toLowerCase().startsWith(pre)));
      if (!selected.size) continue;
      const bases = new Set<string | undefined>();
      if (!selected.has(all[0])) bases.add(all[0]);
      for (const n of selected) {
        let s = scenarios.find((x) => x.ScenarioName === n);
        for (let p = parentName(scenarios, s); p && s; p = parentName(scenarios, s)) {
          s = scenarios.find((x) => sameName(x.ScenarioName, p));
          if (s && !selected.has(s.ScenarioName)) bases.add(s.ScenarioName);
        }
      }
      shown = [...all.filter((n) => bases.has(n)).map((name) => ({ name, isBase: true })), ...all.filter((n) => selected.has(n)).map((name) => ({ name, isBase: false }))];
    }

    // Scenarios comparison.config.json excludes are left out of the docs entirely
    const anyShown = shown.length > 0;
    shown = shown.filter(({ name }) => !isExcluded(key, name));
    if (anyShown && !shown.length) continue;
    let lastNote = Date.now();
    const pages = shown.map(({ name, isBase }, i): ScenarioPage => {
      // A slow test (tracing the mapping the first time) says how far it has got every 15 seconds
      if (Date.now() - lastNote > 15_000) {
        console.error(`  ${key}: ${i}/${shown.length} scenarios...`);
        lastNote = Date.now();
      }
      const raw = scenarios?.find((s) => sameName(s.ScenarioName, name));
      const input = select(scenarios, inputObj, name);
      const parent = raw && scenarios ? parentName(scenarios, raw) : undefined;
      const expected = resultsObj ? select(resultScenarios, resultsObj, name) : undefined;
      let parentExpected: any;
      try {
        parentExpected = parent && resultScenarios ? select(resultScenarios, resultsObj, parent) : undefined;
      } catch {
        parentExpected = undefined;
      }
      const calc = runCalculator(key, input);
      const neutralModule = moduleFor(key);
      let neutral: ScenarioPage["neutral"];
      if (neutralModule)
        try {
          neutral = { value: neutralModule.fromVeerg(input) };
        } catch (error: any) {
          neutral = { error: String(error?.message ?? error).slice(0, 500) };
        }
      const title = name === undefined ? (scenarios ? "(first, unnamed)" : "(no scenarios)") : formatScenarioTitle(name);
      return {
        name,
        title,
        slug: (isBase ? "base-" : "") + slug(name ?? title),
        isBase,
        description: raw?.ScenarioDescription?.trim() || undefined,
        extends: parent ? formatScenarioTitle(parent) : undefined,
        notes: notesOf(raw),
        inputs: inputGroups(input, parent ? basis(select(scenarios, inputObj, parent)) : undefined, labels),
        neutral,
        mapping: neutralModule && neutral?.value !== undefined ? scenarioMapping(neutralModule, neutral.value, calculator(), !!opts.trace) : undefined,
        calcInputs: calc.inputs,
        results: resultRows(expected, parentExpected, calc.results, key, name, input),
        calc: { status: calc.status, message: calc.message, notes: [...new Set(calc.notes)], decisions: calc.decisions },
        followOns: followOns(raw ?? (scenarios ? undefined : inputObj)),
      };
    });
    models.push({ id, group, key, missing: false, pages });
    const traced = traceStats.traced - before.traced;
    const cached = traceStats.cached - before.cached;
    const mapping = traced ? `, mapping traced for ${traced}${cached ? ` (${cached} cached)` : ""}` : "";
    console.error(`  ${key}: ${pages.length} scenario${pages.length === 1 ? "" : "s"}, ${((Date.now() - started) / 1000).toFixed(1)}s${mapping}`);
  }
  return models;
};

/** Version of the calculator compared. */
export const calculatorVersion = () => {
  try {
    return calculator().version();
  } catch {
    return undefined;
  }
};
