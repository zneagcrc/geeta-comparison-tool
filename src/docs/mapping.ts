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
import { translated } from "../neutral/geeta-format";
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

/** How a trace went: calculator runs, time in the calculator and in all, inputs settled by batches, inputs with a hint. */
export type TraceStats = { runs: number; calcMs: number; ms: number; inputs: number; batched: number; hinted: number };

/**
 * The scenario's mapping, and what the adapter gave the calculator that no neutral input reaches (defaults, constants).
 * A cached trace also says which test it belongs to, when it was made and how it went (older caches don't).
 */
export type Mapping = { rows: MappingRow[]; adapterOnly: Landing[]; calculatorTraced: boolean; test?: string; tracedAt?: number; stats?: TraceStats };

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

/**
 * Tests whose captureInputsWithoutCalculating gave the same inputs as calculateAndCaptureInputs on their first scenario
 * (true), or different ones (false: that test is traced with the calculation).
 */
const captureOnlyChecked = new Map<string, boolean>();

/** The calculator's inputs for a neutral scenario, without calculating where the calculator allows it; throws on invalid input. */
const inputsFor = (calc: Calculator, module: NeutralModule, s: any): InputCall[] | undefined => {
  // The calculator's own entry point from a neutral scenario, else its adapter on the workbook fixture regenerated from it
  const adapter = calc.adapters[module.test];
  const results = calc.neutralResults?.[module.test] ?? (adapter && ((n: any) => adapter(module.toVeerg(n))));
  if (!results) return undefined;
  const calculating = () => quiet(() => calc.calculateAndCaptureInputs!(() => results(s))).inputs;
  if (calc.captureInputsWithoutCalculating) {
    const only = () => quiet(() => calc.captureInputsWithoutCalculating!(() => results(s)));
    if (!calc.calculateAndCaptureInputs) return only();
    // Trusted only once both ways gave the same inputs for a scenario of the test
    if (!captureOnlyChecked.has(module.test)) {
      const same = JSON.stringify(only()) === JSON.stringify(calculating());
      captureOnlyChecked.set(module.test, same);
      if (!same) progress(`  ${module.test}: captureInputsWithoutCalculating gives other inputs than calculateAndCaptureInputs, so it is traced with the calculation`);
    }
    if (captureOnlyChecked.get(module.test)) return only();
  }
  return calc.calculateAndCaptureInputs ? calculating() : undefined;
};

// --- progress (a calculator-side trace can run for many minutes per scenario) ---------

const PROGRESS_EVERY = 10_000;
const duration = (ms: number) => (ms < 90_000 ? `${Math.round(ms / 1000)}s` : `${(ms / 60_000).toFixed(1)} min`);
/** A progress line on stderr, with the time of day (a long trace is often left running). */
export const progress = (line: string) =>
  process.stderr.write(`${new Date().toTimeString().slice(0, 8)} ${worker ? `w${worker.index} ` : ""}${line}\n`);

/**
 * Set in the worker processes of a parallel trace (`mapping trace --jobs N`): which one this is, and the folder where the
 * workers claim scenarios, so each scenario is traced once.
 */
export const worker = (() => {
  const m = /^(\d+)\/(\d+)$/.exec(process.env.GEETA_TRACE_WORKER ?? "");
  return m && process.env.GEETA_TRACE_CLAIMS ? { index: Number(m[1]), count: Number(m[2]), claims: process.env.GEETA_TRACE_CLAIMS } : undefined;
})();

// --- hints: what earlier traces found, so a trace can test many inputs at once --------

/**
 * What an earlier trace found for an input: its value carried into calculator fields (copied or converted), not used by
 * the calculator at all, or anything else (looked up, worked out, a share, failing validation). A hint only decides
 * which inputs are tried together; the trace still finds every landing itself, so a wrong hint costs runs, never results.
 */
type Hint = "carried" | "unused" | "other";
const CARRIED = new Set(["=", "×100", "÷100", "×1000", "÷1000", "as %"]);
const hintOf = (r: MappingRow): Hint =>
  r.note ? "other" : !r.calculator.length ? "unused" : typeof r.value === "number" && r.calculator.every((l) => CARRIED.has(l.relation ?? "")) ? "carried" : "other";
const pathKey = (p: string[]) => p.join("\u0000");

/** Calculator runs of the trace in progress (for its progress lines and its summary). */
const run = { count: 0, ms: 0 };
/** The inputs of the trace in progress: how many, how many batches settled, how many had a hint. */
let traced = { inputs: 0, batched: 0, hinted: 0 };

/** Whether a calculator field carries an input's value: its new value copied or converted from the input's new value, and its old value (if it had one) from the old one the same way. */
const carries = (before: number, after: number, fieldBefore: unknown, fieldAfter: unknown) => {
  const r = relation(after, fieldAfter);
  if (!r || r === "↦") return false;
  if (fieldBefore === undefined || relation(before, fieldBefore) === r) return true;
  return before === 0 && ["=", "as %"].includes(relation(0, fieldBefore) ?? "");
};

/** A value of its own for each input of a batch (the k-th), close to the input's value, so a field shows whose value it carries. */
const batchValue = (v: number, k: number) => (v === 0 ? 0.37 : v * 0.73) * (1 + (k + 1) * 1e-4);

/** Batched tracing (on unless GEETA_TRACE_BATCH=0, which traces every input on its own, for comparison). */
const batching = () => process.env.GEETA_TRACE_BATCH !== "0";

const traceMapping = (
  module: NeutralModule,
  neutral: any,
  calc: Calculator,
  baseCalc: Map<string, unknown> | undefined,
  label?: string,
  hints?: Map<string, Hint>,
): MappingRow[] => {
  const baseFixture = flatFixture(module.toVeerg(neutral));
  const leaves = inputLeaves(neutral);
  const started = Date.now();
  let lastNote = started;
  let current = 0;
  let batchSize = 0;
  run.count = run.ms = 0;
  if (label && baseCalc) progress(`  ${label}: tracing ${leaves.length} inputs (each value tried runs ${calc.name})`);
  const runCalc = (s: any): Map<string, unknown> | undefined => {
    if (!baseCalc) return undefined;
    const t0 = Date.now();
    try {
      const calls = inputsFor(calc, module, s);
      return calls && flatInputs(calls);
    } catch {
      return undefined;
    } finally {
      run.count++;
      run.ms += Date.now() - t0;
      if (label && Date.now() - lastNote > PROGRESS_EVERY) {
        lastNote = Date.now();
        const elapsed = lastNote - started;
        const left = current ? (elapsed / current) * (leaves.length - current) : undefined;
        progress(
          `    input ${current + 1}/${leaves.length} (${batchSize ? `a batch of ${batchSize} from ` : ""}${leaves[current]?.path.join(" › ")}): ` +
            `${run.count} runs at ${(run.ms / run.count / 1000).toFixed(1)}s, ${duration(elapsed)} so far` +
            (left !== undefined ? `, about ${duration(left)} left` : ""),
        );
      }
    }
  };
  // Fields this scenario has (a change that moves an entry, e.g. fuel from stationary to transport, also creates others)
  const landings = (fields: string[], now: Map<string, unknown>, value: unknown): Landing[] => {
    const present = fields.filter((f) => now.has(f));
    return (present.length ? present : fields).map((field) => ({ field, value: now.get(field), relation: relation(value, now.get(field)) }));
  };

  // Batches: many inputs tried in one calculator run, each settled from what changed. Inputs a batch can't settle are
  // traced on their own below.
  //
  // Numbers: each input of a batch is changed to a value of its own, and each calculator field that changed is credited
  // to the input whose value it carries. A field no single input accounts for (worked out from several, or looked up)
  // splits the batch in two, down to single inputs. Without hints, a batch is one table (a livestock class × month
  // grid, say), and one the calculator rejects is split once more; if a half is rejected too, its inputs are traced one
  // at a time. Numbers an earlier trace found carried or unused go in one batch for the whole scenario, split as often as
  // it takes.
  //
  // Other values an earlier trace found unused (names, options, flags): every one changed to each value it would be
  // tried with, all at once. Nothing changing in the calculator settles them all; anything changing splits the batch.
  const batched = new Map<number, string[]>();
  const hintFor = (i: number) => hints?.get(pathKey(leaves[i].path));
  const hinted = leaves.filter((_, i) => hintFor(i)).length;
  if (baseCalc && batching()) {
    const groups = new Map<string, number[]>();
    const wide: number[] = [];
    const unused: number[] = [];
    leaves.forEach((l, i) => {
      const h = hintFor(i);
      if (typeof l.value !== "number") {
        if (h === "unused") unused.push(i);
        return;
      }
      if (h === "carried" || h === "unused") return void wide.push(i);
      if (h === "other") return;
      const g = l.path.slice(0, -2).join("\u0000");
      groups.set(g, [...(groups.get(g) ?? []), i]);
    });
    const resolve = (ids: number[], rejections: number): void => {
      if (ids.length < 2) return;
      current = ids[0];
      batchSize = ids.length;
      const values = new Map(ids.map((id, k) => [id, batchValue(leaves[id].value as number, k)]));
      let s = neutral;
      for (const [id, v] of values) s = setAt(s, leaves[id].path, v);
      const now = runCalc(s);
      const half = Math.ceil(ids.length / 2);
      const split = (left: number) => {
        resolve(ids.slice(0, half), left);
        resolve(ids.slice(half), left);
      };
      if (!now) return rejections > 0 ? split(rejections - 1) : undefined;
      const fields = new Map(ids.map((id) => [id, [] as string[]]));
      for (const f of changed(baseCalc, now)) {
        const who = ids.filter((id) => carries(leaves[id].value as number, values.get(id)!, baseCalc.get(f), now.get(f)));
        if (who.length !== 1) return split(Math.max(rejections, 1));
        fields.get(who[0])!.push(f);
      }
      for (const [id, fs] of fields) batched.set(id, fs);
    };
    resolve(wide, Infinity);
    for (const ids of groups.values()) resolve(ids, 1);
    const confirmUnused = (ids: number[]): void => {
      if (ids.length < 2) return;
      current = ids[0];
      batchSize = ids.length;
      const tries = new Map(ids.map((id) => [id, nudge(leaves[id].value, leaves[id].path)]));
      const half = Math.ceil(ids.length / 2);
      for (let k = 0; k < Math.max(...[...tries.values()].map((t) => t.length)); k++) {
        let s = neutral;
        for (const id of ids) if (k < tries.get(id)!.length) s = setAt(s, leaves[id].path, tries.get(id)![k]);
        const now = runCalc(s);
        if (!now || changed(baseCalc, now).length) {
          confirmUnused(ids.slice(0, half));
          confirmUnused(ids.slice(half));
          return;
        }
      }
      for (const id of ids) batched.set(id, []);
    };
    // An input with no other value to try is settled below without a run
    confirmUnused(unused.filter((id) => nudge(leaves[id].value, leaves[id].path).length));
    batchSize = 0;
  }
  if (label && baseCalc && batched.size)
    progress(`  ${label}: ${batched.size} of ${leaves.length} inputs settled in batches (${run.count} runs${hinted ? `, ${hinted} inputs with hints from earlier traces` : ""})`);
  traced = { inputs: leaves.length, batched: batched.size, hinted };

  return leaves
    .map(({ path: at, value }, i) => {
      current = i;
      const tries = nudge(value, at);
      let geeta: string[] = [];
      // A string: any value shows where the workbook copies it (a looked-up one shows through the tries below)
      if (typeof value === "string")
        try {
          geeta = changed(baseFixture, flatFixture(module.toVeerg(setAt(neutral, at, SENTINEL))));
        } catch {
          // not a free-text field
        }
      // A batch traced it already: only GEETA's side is left (which needs no calculator run)
      let calcFields: string[] | undefined = batched.get(i);
      for (const t of tries) {
        const s = setAt(neutral, at, t);
        try {
          geeta = [...new Set([...geeta, ...changed(baseFixture, flatFixture(module.toVeerg(s)))])];
        } catch {
          // a value the workbook format can't take
        }
        const now = batched.has(i) ? undefined : runCalc(s);
        if (now) calcFields = [...new Set([...(calcFields ?? []), ...changed(baseCalc!, now)])];
      }
      // A number the calculator rejects higher (a fraction near 1, say) may take a lower value: the value a batch would try
      if (baseCalc && calcFields === undefined && typeof value === "number" && value !== 0) {
        const now = runCalc(setAt(neutral, at, batchValue(value, 0)));
        if (now) calcFields = changed(baseCalc, now);
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


/** Only GEETA's side of a scenario's mapping: where each neutral input lands in the workbook. Needs no calculator. */
export const traceGeetaSide = (module: NeutralModule, neutral: any): MappingRow[] =>
  traceMapping(module, neutral, { name: "" } as Calculator, undefined);

/**
 * A scenario's trace without the cache, and the calculator runs it took (for checks comparing batched, hinted and
 * single-input traces). `hintsFrom`: the rows of an earlier trace to take hints from.
 */
export const traceUncached = (module: NeutralModule, neutral: any, calc: Calculator, hintsFrom?: MappingRow[]) => {
  const base = inputsFor(calc, module, neutral);
  const hints = hintsFrom && new Map(hintsFrom.map((r) => [pathKey(r.path), hintOf(r)]));
  const rows = traceMapping(module, neutral, calc, base && flatInputs(base), undefined, hints);
  return { rows, runs: run.count, ...traced };
};

// --- cache ------------------------------------------------------------------------
//
// <docsDir>/.mapping-cache.json holds every trace, keyed by what it depends on. The workers of a parallel trace read it
// but don't write it: each writes the traces it makes to a shard of its own (.mapping-cache.w<n>.json, with the keys it
// used), and the command that started them merges the shards into the cache when they finish. A shard left by an
// interrupted run is merged the next time the cache is read.

const CACHE_VERSION = 3;
let lastSave = Date.now();
type Cache = { file: string; entries: Record<string, Mapping>; used: Set<string>; fresh: Set<string> };
let cache: Cache | undefined;

const cacheFileOf = (calc: Calculator) => inWorkspace(calc.docsDir, ".mapping-cache.json");
const SHARD = /^\.mapping-cache\.w(\d+)\.json$/;
const shardFile = (file: string, index: number) => path.join(path.dirname(file), `.mapping-cache.w${index}.json`);
const shardsOf = (file: string) =>
  fs.existsSync(path.dirname(file)) ? fs.readdirSync(path.dirname(file)).filter((f) => SHARD.test(f)).map((f) => path.join(path.dirname(file), f)) : [];
type Shard = { entries: Record<string, Mapping>; used: string[]; stats?: Partial<typeof traceStats> };
const readShard = (f: string): Shard | undefined => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return undefined; // cut short
  }
};

const cacheFor = (calc: Calculator) => {
  const file = cacheFileOf(calc);
  if (cache?.file !== file) {
    const entries: Record<string, Mapping> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    // Shards from an interrupted run (a worker leaves the others' shards alone: it reads them for hints)
    if (!worker) for (const f of shardsOf(file)) Object.assign(entries, readShard(f)?.entries ?? {});
    cache = { file, entries, used: new Set(), fresh: new Set() };
    hintIndex = undefined;
  }
  return cache;
};

/**
 * Scenario mappings traced this run, read from the cache, left untraced, and (in a worker) left to another worker; and
 * over the scenarios traced: calculator runs, time in the calculator and in all, inputs, inputs settled in batches.
 */
export const traceStats = { traced: 0, cached: 0, untraced: 0, elsewhere: 0, runs: 0, calcMs: 0, ms: 0, inputs: 0, batched: 0 };

/** The cache file, relative to the workspace (for progress messages). */
export const mappingCacheFile = (calc: Calculator) => path.join(calc.docsDir, ".mapping-cache.json");

/**
 * Writes the cache. `prune` (a run over every scenario) drops entries this run didn't use; a filtered run keeps them.
 * A worker writes its shard instead. Shards are removed once merged.
 */
export const saveMappingCache = (prune = false) => {
  if (!cache) return;
  const { entries, used, fresh } = cache;
  fs.mkdirSync(path.dirname(cache.file), { recursive: true });
  if (worker) {
    const shard: Shard = { entries: Object.fromEntries([...fresh].map((k) => [k, entries[k]])), used: [...used], stats: traceStats };
    const f = shardFile(cache.file, worker.index);
    fs.writeFileSync(`${f}.tmp`, JSON.stringify(shard) + "\n");
    fs.renameSync(`${f}.tmp`, f);
    return;
  }
  if (prune) for (const k of Object.keys(entries)) if (!used.has(k)) delete entries[k];
  fs.writeFileSync(`${cache.file}.tmp`, JSON.stringify(entries) + "\n");
  fs.renameSync(`${cache.file}.tmp`, cache.file);
  for (const f of shardsOf(cache.file)) fs.rmSync(f, { force: true });
};

/**
 * Before and after the workers of a parallel trace: shards merged into the cache. After them (`counts`), their counts
 * are added up and the keys they used kept, so `prune` (a run over every scenario that every worker finished) can drop
 * traces no scenario uses any more.
 */
export const mergeTraceShards = (calc: Calculator, { counts = false, prune = false } = {}) => {
  cache = undefined;
  const c = cacheFor(calc);
  const shards = shardsOf(c.file).map(readShard).filter((s): s is Shard => !!s);
  if (counts)
    for (const s of shards) {
      for (const k of s.used) c.used.add(k);
      for (const [k, v] of Object.entries(s.stats ?? {})) (traceStats as Record<string, number>)[k] += v as number;
    }
  saveMappingCache(prune && shards.length > 0);
};

// Hints: per test, what the latest trace of each input found (traces in older caches, which don't say their test, count
// for every test). Workers also read the other workers' shards, so their later scenarios get hints from all of them.
let hintIndex: { tests: Map<string, Map<string, Hint>>; shards: Map<string, number> } | undefined;
const addHints = (m: Mapping) => {
  if (!m.calculatorTraced || !hintIndex) return;
  const test = m.test ?? "*";
  const hints = hintIndex.tests.get(test) ?? new Map<string, Hint>();
  hintIndex.tests.set(test, hints);
  for (const r of m.rows) hints.set(pathKey(r.path), hintOf(r));
};
const hintsFor = (c: Cache, test: string): Map<string, Hint> => {
  if (!hintIndex) {
    hintIndex = { tests: new Map(), shards: new Map() };
    for (const m of Object.values(c.entries).sort((a, b) => (a.tracedAt ?? 0) - (b.tracedAt ?? 0))) addHints(m);
  }
  if (worker)
    for (const f of shardsOf(c.file)) {
      if (f === shardFile(c.file, worker.index)) continue;
      const mtime = fs.statSync(f, { throwIfNoEntry: false })?.mtimeMs ?? 0;
      if (hintIndex.shards.get(f) === mtime) continue;
      hintIndex.shards.set(f, mtime);
      for (const m of Object.values(readShard(f)?.entries ?? {})) addHints(m);
    }
  return new Map([...(hintIndex.tests.get("*") ?? []), ...(hintIndex.tests.get(test) ?? [])]);
};

/** A worker's claim on a scenario: false when another worker has it. */
const claim = (key: string) => {
  if (!worker) return true;
  try {
    fs.closeSync(fs.openSync(path.join(worker.claims, key), "wx"));
    return true;
  } catch {
    return false;
  }
};

/**
 * The mapping of one scenario. Cached by the neutral scenario, the calculator's inputs for it (so an adapter change
 * re-traces) and the calculator's version. Without `trace`, a mapping that would run the calculator is only read from the
 * cache (null when it isn't there). `label` names the scenario in progress lines (only a calculator-side trace prints them).
 */
export const scenarioMapping = (module: NeutralModule, neutral: any, calc: Calculator, trace = true, label?: string): Mapping | null => {
  let base: InputCall[] | undefined;
  try {
    base = inputsFor(calc, module, neutral);
  } catch {
    // the calculator side isn't traced
  }
  const key = crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        CACHE_VERSION, module.test, neutral, base ?? null, calc.id, calc.version(),
        // A release in a newer test format (renamed inputs) has other GEETA field names for the same neutral scenario;
        // left out for the specs' own format, so caches made with it stay valid
        ...(translated() ? [module.toVeerg(neutral)] : []),
      ]),
    )
    .digest("hex")
    .slice(0, 20);
  const c = cacheFor(calc);
  c.used.add(key);
  if (c.entries[key]) traceStats.cached++;
  // Without the calculator's inputs (no adapter yet, or no calculateAndCaptureInputs) a trace is quick: only GEETA's side is traced
  else if (!trace && base) {
    traceStats.untraced++;
    return null;
  } else if (!claim(key)) {
    traceStats.elsewhere++;
    return null;
  } else {
    traceStats.traced++;
    const baseCalc = base ? flatInputs(base) : undefined;
    const t0 = Date.now();
    const rows = traceMapping(module, neutral, calc, baseCalc, label, baseCalc && hintsFor(c, module.test));
    const ms = Date.now() - t0;
    const stats: TraceStats = { runs: run.count, calcMs: run.ms, ms, ...traced };
    if (baseCalc) {
      for (const k of ["runs", "calcMs", "ms", "inputs", "batched"] as const) traceStats[k] += stats[k];
      if (label)
        progress(
          `  ${label}: traced in ${duration(ms)} (${run.count} runs of ${calc.name}, ${ms ? Math.round((100 * run.ms) / ms) : 0}% of the time in ${calc.name}; ` +
            `${traced.batched} of ${traced.inputs} inputs settled in batches)`,
        );
    }
    const reached = new Set(rows.flatMap((r) => r.calculator.map((l) => l.field)));
    c.entries[key] = {
      rows,
      adapterOnly: [...(baseCalc ?? [])].filter(([f]) => !reached.has(f)).map(([field, value]) => ({ field, value })),
      calculatorTraced: !!baseCalc,
      test: module.test,
      tracedAt: Date.now(),
      ...(baseCalc ? { stats } : {}),
    };
    c.fresh.add(key);
    addHints(c.entries[key]);
    // Save as it goes, so an interrupted run keeps what it traced (a worker's shard is small: only its own traces)
    if (worker ? !!baseCalc : Date.now() - lastSave > 30_000) {
      saveMappingCache();
      lastSave = Date.now();
      if (label && baseCalc && !worker) progress(`  (saved ${Object.keys(c.entries).length} traces to ${mappingCacheFile(calc)}; stopping now keeps them)`);
    }
  }
  return c.entries[key];
};
