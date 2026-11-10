// How each neutral input reaches GEETA and the calculator, traced rather than declared, so it works for any calculator:
// change one neutral input, regenerate the workbook fixture (the neutral spec's toVeerg) and re-run the calculator from
// the neutral scenario (Calculator.neutralResults, with its inputs captured), and see which workbook fields and which
// calculator input fields change. Shares that must add up (allocations) can't change alone, so they are moved to or
// from a sibling instead, and only the fields that change with every sibling are kept. Traces are cached per scenario.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { findTest, loadCases } from "../fixtures";
import { MODULES, type NeutralModule } from "../neutral/registry";
import type { Calculator, InputCall } from "../calculators/types";
import { inWorkspace } from "../workspace";

/** Where a value lands: a field and the value there, with how it relates to the neutral value when recognisable. */
export type Landing = { field: string; value: unknown; relation?: string };

export type MappingRow = {
  /** Path in the neutral scenario, e.g. ["inputs", "N_j", "1 = Boars"]. */
  path: string[];
  value: unknown;
  geeta: Landing[];
  calculator: Landing[];
  /** Why the calculator side couldn't be traced, or how it was. */
  note?: string;
};

/** The scenario's mapping, and what the adapter gave the calculator that no neutral input reaches (defaults, constants). */
export type Mapping = { rows: MappingRow[]; adapterOnly: Landing[]; calculatorTraced: boolean };

type Leaf = { path: string[]; value: unknown };

const leaves = (o: unknown, at: string[] = []): Leaf[] =>
  Array.isArray(o)
    ? o.flatMap((v, i) => leaves(v, [...at, String(i)]))
    : o && typeof o === "object"
      ? Object.entries(o).flatMap(([k, v]) => leaves(v, [...at, k]))
      : [{ path: at, value: o }];

const setAt = (o: any, at: string[], v: unknown) => {
  const copy = structuredClone(o);
  let cur = copy;
  for (const k of at.slice(0, -1)) cur = cur[k];
  cur[at[at.length - 1]] = v;
  return copy;
};

/** Workbook fixture as flat fields: cells by name, table fields as "Table › Row or Col › Field". */
const flatFixture = (fixture: any): Map<string, unknown> => {
  const out = new Map<string, unknown>();
  for (const [k, v] of Object.entries(fixture ?? {})) if (k !== "InputTables" && (typeof v !== "object" || v === null)) out.set(k, v);
  for (const t of fixture?.InputTables ?? [])
    for (const container of ["Cols", "Rows"] as const)
      for (const [member, fields] of Object.entries<any>(t[container] ?? {}))
        for (const [f, v] of Object.entries(fields ?? {})) out.set(`${t.TableName} › ${member} › ${f}`, v);
  return out;
};

/** Captured calculator inputs as flat fields: "Schema › path". */
const flatInputs = (calls: InputCall[]): Map<string, unknown> => {
  const out = new Map<string, unknown>();
  calls.forEach((c, i) => {
    const name = calls.filter((d) => d.schema === c.schema).length > 1 ? `${c.schema} #${i + 1}` : c.schema;
    for (const l of leaves(c.input)) out.set([name, ...l.path].join(" › "), l.value);
  });
  return out;
};

const changed = (a: Map<string, unknown>, b: Map<string, unknown>) =>
  [...new Set([...a.keys(), ...b.keys()])].filter((k) => JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k)));

/** How a landed value relates to the neutral value: copied, or a recognisable conversion. */
const relation = (neutral: unknown, landed: unknown) => {
  if (JSON.stringify(neutral) === JSON.stringify(landed)) return "=";
  if (typeof neutral === "number" && typeof landed === "number" && neutral !== 0) {
    const r = landed / neutral;
    for (const [f, label] of [[100, "×100"], [0.01, "÷100"], [1000, "×1000"], [0.001, "÷1000"]] as const)
      if (Math.abs(r - f) <= 1e-9 * f) return label;
  }
  if (typeof landed === "string" && typeof neutral === "number" && landed === `${Number((neutral * 100).toFixed(8))}%`) return "as %";
  // A name or flag written as the other side's code ("Western Australia" -> "wa", true -> "Yes")
  if (typeof landed === "string" && (typeof neutral === "string" || typeof neutral === "boolean")) return "↦";
  return undefined;
};

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

/** A neutral scenario's inputs: everything but its section and name, and an enterprise's leftover table layout. */
const inputLeaves = (n: any) =>
  leaves(Object.fromEntries(Object.entries(n).filter(([k]) => k !== "section" && k !== "scenario"))).filter(
    (l) => l.value !== undefined && l.value !== null && !(l.path[0] === "workbook" && l.path[1] === "tableLayout"),
  );

/** Row numbers and dimension members don't name an input: key the pool by the input name and the names above it. */
const poolKeys = (at: string[]) => {
  const named = at.filter((k) => !/^\d+$/.test(k));
  return [named.slice(-2).join(" / "), named[named.length - 1]];
};

let pool: Map<string, string[]> | undefined;
/**
 * String values seen for each neutral input name across every module fixture: valid alternatives to try, where an
 * arbitrary string would fail the calculator's validation.
 */
const valuePool = () => {
  if (pool) return pool;
  pool = new Map();
  for (const m of MODULES) {
    // A neutral format can exist for a test the GEETA release leaves out
    const test = findTest(m.test);
    if (!test) continue;
    for (const c of loadCases(test)) {
      let n: any;
      try {
        n = quiet(() => m.fromVeerg(c.input));
      } catch {
        continue;
      }
      for (const l of inputLeaves(n))
        if (typeof l.value === "string")
          for (const key of poolKeys(l.path)) {
            const list = pool.get(key) ?? [];
            if (!list.includes(l.value)) pool.set(key, [...list, l.value]);
          }
    }
  }
  return pool;
};

/** Different values of the same kind to try: a number changed, a boolean flipped, strings from the value pool. */
const nudge = (v: unknown, at: string[]): unknown[] => {
  if (typeof v === "number") return [v === 0 ? 0.37 : v * 1.37 + (Number.isInteger(v) ? 1 : 0)];
  if (typeof v === "boolean") return [!v];
  if (typeof v !== "string") return [];
  const [specific, general] = poolKeys(at);
  return [...new Set([...(valuePool().get(specific) ?? []), ...(valuePool().get(general) ?? [])])].filter((a) => a !== v).slice(0, 3);
};

/** A string no workbook lookup or calculator knows: enough to see which workbook fields a string is copied to. */
const SENTINEL = "⟨traced⟩";

/** The calculator's inputs for a neutral scenario, without calculating where the calculator allows it; throws on invalid input. */
const inputsFor = (calc: Calculator, module: NeutralModule, s: any): InputCall[] | undefined => {
  // The calculator's own entry point from a neutral scenario, else its adapter on the workbook fixture regenerated from it
  const adapter = calc.adapters[module.test];
  const results = calc.neutralResults?.[module.test] ?? (adapter && ((n: any) => adapter(module.toVeerg(n))));
  if (!results) return undefined;
  if (calc.captureInputsOnly) return quiet(() => calc.captureInputsOnly!(() => results(s)));
  return calc.captureInputs ? quiet(() => calc.captureInputs!(() => results(s))).inputs : undefined;
};

const traceMapping = (module: NeutralModule, neutral: any, calc: Calculator, baseCalc: Map<string, unknown> | undefined): MappingRow[] => {
  const baseFixture = flatFixture(module.toVeerg(neutral));
  const runCalc = (s: any): Map<string, unknown> | undefined => {
    if (!baseCalc) return undefined;
    try {
      const calls = inputsFor(calc, module, s);
      return calls && flatInputs(calls);
    } catch {
      return undefined;
    }
  };
  // Fields this scenario has (a change that moves an entry, e.g. fuel from stationary to transport, also creates others)
  const landings = (fields: string[], now: Map<string, unknown>, value: unknown): Landing[] => {
    const present = fields.filter((f) => now.has(f));
    return (present.length ? present : fields).map((field) => ({ field, value: now.get(field), relation: relation(value, now.get(field)) }));
  };

  return inputLeaves(neutral)
    .map(({ path: at, value }) => {
      const tries = nudge(value, at);
      let geeta: string[] = [];
      // A string: any value shows where the workbook copies it (a looked-up one shows through the tries below)
      if (typeof value === "string")
        try {
          geeta = changed(baseFixture, flatFixture(module.toVeerg(setAt(neutral, at, SENTINEL))));
        } catch {
          // not a free-text field
        }
      let calcFields: string[] | undefined;
      for (const t of tries) {
        const s = setAt(neutral, at, t);
        try {
          geeta = [...new Set([...geeta, ...changed(baseFixture, flatFixture(module.toVeerg(s)))])];
        } catch {
          // a value the workbook format can't take
        }
        const now = runCalc(s);
        if (now) calcFields = [...new Set([...(calcFields ?? []), ...changed(baseCalc!, now)])];
      }
      let note: string | undefined;
      // A share that can't change alone: move some of it to (or from) a sibling, and keep what changes with every sibling
      if (baseCalc && calcFields === undefined && typeof value === "number") {
        const parent = at.slice(0, -1);
        const siblings = Object.entries<any>(parent.reduce((o: any, k) => o?.[k], neutral) ?? {}).filter(
          ([k, v]) => k !== at[at.length - 1] && typeof v === "number",
        );
        const sets: string[][] = [];
        const used: string[] = [];
        for (const [k, v] of siblings) {
          const d = value > 0 ? value / 2 : -v / 2;
          if (!d) continue;
          const now = runCalc(setAt(setAt(neutral, at, value - d), [...parent, k], v + d));
          if (now) {
            sets.push(changed(baseCalc, now));
            used.push(k);
          }
          if (sets.length === 2) break;
        }
        if (sets.length) {
          calcFields = sets.reduce((a, b) => a.filter((f) => b.includes(f)));
          note = sets.length === 1 ? `a share: traced by moving part of it to ${used[0]}` : "a share: traced by moving part of it to its siblings";
        }
      }
      if (baseCalc && calcFields === undefined)
        note = tries.length ? "every other value tried fails the calculator's validation" : "no other valid value to try";
      return {
        path: at,
        value,
        geeta: landings(geeta, baseFixture, value),
        calculator: calcFields ? landings(calcFields, baseCalc!, value) : [],
        ...(note ? { note } : {}),
      };
    });
};

// --- cache ------------------------------------------------------------------------

const CACHE_VERSION = 3;
let lastSave = Date.now();
let cache: { file: string; entries: Record<string, Mapping>; used: Set<string> } | undefined;
const cacheFor = (calc: Calculator) => {
  const file = inWorkspace(calc.docsDir, ".mapping-cache.json");
  if (cache?.file !== file) cache = { file, entries: fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}, used: new Set() };
  return cache;
};

/** Writes the cache. `prune` (a run over every scenario) drops entries this run didn't use; a filtered run keeps them. */
export const saveMappingCache = (prune = false) => {
  if (!cache) return;
  const { entries, used } = cache;
  if (prune) for (const k of Object.keys(entries)) if (!used.has(k)) delete entries[k];
  fs.mkdirSync(path.dirname(cache.file), { recursive: true });
  fs.writeFileSync(cache.file, JSON.stringify(entries) + "\n");
};

/**
 * The mapping of one scenario. Cached by the neutral scenario, the calculator's inputs for it (so an adapter change
 * re-traces) and the calculator's version.
 */
export const scenarioMapping = (module: NeutralModule, neutral: any, calc: Calculator): Mapping => {
  let base: InputCall[] | undefined;
  try {
    base = inputsFor(calc, module, neutral);
  } catch {
    // the calculator side isn't traced
  }
  const key = crypto
    .createHash("sha256")
    .update(JSON.stringify([CACHE_VERSION, module.test, neutral, base ?? null, calc.id, calc.version()]))
    .digest("hex")
    .slice(0, 20);
  const c = cacheFor(calc);
  c.used.add(key);
  if (!c.entries[key]) {
    const baseCalc = base ? flatInputs(base) : undefined;
    const rows = traceMapping(module, neutral, calc, baseCalc);
    const reached = new Set(rows.flatMap((r) => r.calculator.map((l) => l.field)));
    c.entries[key] = {
      rows,
      adapterOnly: [...(baseCalc ?? [])].filter(([f]) => !reached.has(f)).map(([field, value]) => ({ field, value })),
      calculatorTraced: !!baseCalc,
    };
    // Save as it goes, so an interrupted first run keeps what it traced
    if (Date.now() - lastSave > 30_000) {
      saveMappingCache();
      lastSave = Date.now();
    }
  }
  return c.entries[key];
};
