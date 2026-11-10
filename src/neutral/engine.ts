// Generic conversion between workbook test fixtures and neutral scenarios, driven by a declarative spec per module
// (src/neutral/modules/*.ts). The neutral scenario holds the activity data a user records, named with the VEERG
// documents' terms: the catalogue symbol where an input goes straight into an equation (catalogue/veerg-inputs.md),
// otherwise the description from the chapter, and single-letter subscripts by their description. Dimension members are
// written as the documents write them.
//
// Conversion is lossless both ways and strict: a workbook input the spec doesn't map is an error, so nothing is dropped
// silently. Workbook front-end conveniences that aren't methodology inputs go in the `workbook` block.

export type Value = string | number | boolean | null;
export type Place = "site" | "inputs" | "workbook";

/** How a value is written in the neutral file: as-is, a percentage string ("20%") as a 0-1 fraction, or via a lookup. */
export type Format = { percent?: boolean; values?: Record<string, Value> };

/** `key` may be a path, e.g. ["Q_u", "Unmanaged deep"], to fill one dimensioned input from several workbook cells. */
export type CellSpec = Format & { cell: string; place: Place; key: string | string[] };

/**
 * A table field. In a dimensioned (cols) table the value goes to key -> member -> ...sub, e.g. key "MMS_jmT1",
 * sub ["1 = Anaerobic lagoon"] gives { MMS_jmT1: { "1 = Boars": { "1 = Anaerobic lagoon": 0.15 } } }. With `swap` the
 * member goes last (key -> ...sub -> member), e.g. a month-keyed table read as { LC: { class: { month: v } } }.
 */
export type FieldSpec = Format & { field: string; key: string; sub?: string[]; swap?: boolean; place?: Place };

/** Any field not listed: the field name itself is the next level (e.g. time periods as fields). */
export type AnyFieldSpec = Format & { key: string; swap?: boolean; place?: Place };

/** A list table (fixture Rows keyed Row1, Row2, ...): neutral = array of records keyed by the field specs. */
export type RowTableSpec = {
  kind: "rows";
  table: string;
  place: Place;
  key: string;
  /** Row names are `${rowPrefix}${n}`, n from 1. */
  rowPrefix: string;
  fields: FieldSpec[];
  /** Table properties the workbook generator needs (MatrixType, offsets, ...). */
  props?: Record<string, unknown>;
};

/**
 * A dimensioned table (fixture Cols, or Rows, keyed by member): neutral = one entry per field, { member: value }.
 */
export type ColTableSpec = {
  kind: "cols";
  table: string;
  place: Place;
  /** Whether the fixture keys members under Cols (default) or Rows. */
  container?: "Cols" | "Rows";
  /** Fixture key -> member name as the documents write it, or "as-is" (e.g. time periods like "January 2025"). */
  members: Record<string, string> | "as-is";
  /** Members that aren't a dimension member but their own input (e.g. a "lambing start month" row): key for each. */
  memberKeys?: Record<string, string>;
  fields: FieldSpec[];
  anyField?: AnyFieldSpec;
  props?: Record<string, unknown>;
  /** A table the workbook takes as several blocks at different offsets: which fields or members each block holds. */
  blocks?: { props: Record<string, unknown>; fields?: string[]; members?: string[] }[];
};

export type TableSpec = RowTableSpec | ColTableSpec;

export type ModuleSpec = {
  /** Test key, e.g. "Fuel". */
  test: string;
  /** VEERG section, e.g. "8 Fuel use". */
  section: string;
  cells: CellSpec[];
  tables: TableSpec[];
};

export interface NeutralScenario {
  section: string;
  scenario: { name: string | null; description?: string; notes?: unknown };
  site?: Record<string, Value>;
  inputs: Record<string, any>;
  workbook?: Record<string, any>;
}

const META = new Set(["ScenarioName", "ScenarioDescription", "ScenarioNotes", "ScenarioExtends", "FollowOnTests", "__FormulaOverwritePolicy", "InputTables"]);

const fromPercent = (v: unknown) =>
  typeof v === "string" && /^-?[\d.]+\s*%$/.test(v.trim()) ? Number((parseFloat(v) / 100).toFixed(10)) : v;
const toPercent = (v: unknown) => (typeof v === "number" ? `${Number((v * 100).toFixed(8))}%` : v);

const readValue = (f: Format, v: unknown): Value => {
  if (v === undefined) return null;
  if (f.values) {
    const hit = Object.entries(f.values).find(([fixture]) => fixture === v);
    if (hit) return hit[1];
  }
  return (f.percent ? fromPercent(v) : v) as Value;
};
const writeValue = (f: Format, v: unknown): Value => {
  if (f.values) {
    const hit = Object.entries(f.values).find(([, neutral]) => neutral === v);
    if (hit) return hit[0];
  }
  return (f.percent ? toPercent(v) : v) as Value;
};

const place = (s: NeutralScenario, where: Place): Record<string, any> =>
  where === "inputs" ? s.inputs : ((s[where] ??= {}) as Record<string, any>);

const path = (key: string | string[]) => (Array.isArray(key) ? key : [key]);
const setPath = (o: Record<string, any>, key: string | string[], v: unknown) => {
  const p = path(key);
  let cur = o;
  for (const k of p.slice(0, -1)) cur = cur[k] ??= {};
  cur[p[p.length - 1]] = v;
};
const getPath = (o: Record<string, any> | undefined, key: string | string[]) =>
  path(key).reduce<any>((cur, k) => (cur && typeof cur === "object" && k in cur ? cur[k] : undefined), o);

const isEmpty = (v: unknown) => v === null || v === undefined || v === "";

/** Where a dimensioned-table cell goes in the neutral scenario, and how its value is written. */
const colPath = (t: ColTableSpec, ownKey: string | undefined, member: string | undefined, field: string) => {
  const a = t.anyField;
  if (ownKey) return a ? { path: [ownKey, field], format: a as Format, place: a.place ?? t.place } : undefined;
  const f = t.fields.find((x) => x.field === field);
  if (f) return { path: f.swap ? [f.key, ...(f.sub ?? []), member!] : [f.key, member!, ...(f.sub ?? [])], format: f as Format, place: f.place ?? t.place };
  if (a) return { path: a.swap ? [a.key, field, member!] : [a.key, member!, field], format: a as Format, place: a.place ?? t.place };
  return undefined;
};

/** Every (fixture key, field, value) a dimensioned table holds in a neutral scenario: the inverse of colPath. */
const colEntries = (t: ColTableSpec, s: NeutralScenario): [string, string, unknown][] => {
  const srcFor = (where: Place | undefined): Record<string, any> => (where ?? t.place) === "inputs" ? s.inputs : ((s[where ?? t.place] as Record<string, any>) ?? {});
  const out: [string, string, unknown][] = [];
  const keysOf = (o: unknown) => (o && typeof o === "object" ? Object.keys(o) : []);
  const fixtureKey = (member: string) => (t.members === "as-is" ? member : Object.entries(t.members).find(([, m]) => m === member)?.[0]);
  const members = (o: unknown) => (t.members === "as-is" ? keysOf(o) : Object.values(t.members));
  for (const f of t.fields) {
    const base = srcFor(f.place)[f.key];
    for (const member of members(f.swap ? getPath(base, f.sub ?? []) : base)) {
      const v = getPath(base, f.swap ? [...(f.sub ?? []), member] : [member, ...(f.sub ?? [])]);
      const col = fixtureKey(member);
      if (v !== undefined && col !== undefined) out.push([col, f.field, v]);
    }
  }
  if (t.anyField) {
    const a = t.anyField;
    const src = srcFor(a.place);
    const base = src[a.key];
    const listed = new Set(t.fields.map((f) => f.field));
    if (a.swap)
      for (const field of keysOf(base)) for (const member of members(base[field])) {
        const col = fixtureKey(member);
        if (!listed.has(field) && col !== undefined && base[field][member] !== undefined) out.push([col, field, base[field][member]]);
      }
    else
      for (const member of members(base)) for (const field of keysOf(base?.[member])) {
        const col = fixtureKey(member);
        if (!listed.has(field) && col !== undefined) out.push([col, field, base[member][field]]);
      }
    for (const [col, key] of Object.entries(t.memberKeys ?? {}))
      for (const field of keysOf(src[key])) out.push([col, field, src[key][field]]);
  }
  return out;
};

const formatFor = (t: ColTableSpec, field: string): Format => t.fields.find((f) => f.field === field) ?? t.anyField ?? {};

/**
 * Fixture scenario (resolved) -> neutral scenario. Throws on any workbook input the spec doesn't map, unless `lenient`
 * (for fixtures that hold more than this module, e.g. the enterprise tests used by src/entry-point).
 */
export const fromVeerg = (spec: ModuleSpec, input: any, { lenient = false } = {}): NeutralScenario => {
  const s: NeutralScenario = {
    section: spec.section,
    scenario: {
      name: input.ScenarioName ?? null,
      ...(input.ScenarioDescription ? { description: input.ScenarioDescription } : {}),
      ...(input.ScenarioNotes ? { notes: input.ScenarioNotes } : {}),
    },
    inputs: {},
  };
  const unmapped: string[] = [];

  const cells = new Map(spec.cells.map((c) => [c.cell, c]));
  for (const [k, v] of Object.entries(input)) {
    if (META.has(k)) continue;
    const c = cells.get(k);
    if (!c) {
      unmapped.push(`cell ${k}`);
      continue;
    }
    setPath(place(s, c.place), c.key, readValue(c, v));
  }

  // Tables can be split into several blocks with the same name: merge them
  const byName = new Map<string, any[]>();
  for (const t of input.InputTables ?? []) byName.set(t.TableName, [...(byName.get(t.TableName) ?? []), t]);
  const tables = new Map(spec.tables.map((t) => [t.table, t]));
  for (const [name, blocks] of byName) {
    const t = tables.get(name);
    if (!t) {
      unmapped.push(`table ${name}`);
      continue;
    }
    const fields = new Map(t.fields.map((f) => [f.field, f]));
    if (t.kind === "rows") {
      const rows: Record<string, Value>[] = [];
      for (const b of blocks)
        for (const [rowName, row] of Object.entries<any>(b.Rows ?? {})) {
          let n = Number(rowName.slice(t.rowPrefix.length));
          if (!rowName.startsWith(t.rowPrefix) || !Number.isInteger(n) || n < 1) {
            // Lenient: take rows with other names in order (e.g. a stale enterprise fixture naming rows "Lime1")
            if (lenient) n = rows.length + 1;
            else {
              unmapped.push(`${name} row ${rowName} (expected ${t.rowPrefix}<n>)`);
              continue;
            }
          }
          const rec: Record<string, Value> = { ...(rows[n - 1] ?? {}) };
          for (const [field, v] of Object.entries(row ?? {})) {
            const f = fields.get(field);
            if (!f) unmapped.push(`${name}.${field}`);
            else if (!isEmpty(v)) rec[f.key] = readValue(f, v);
          }
          rows[n - 1] = rec;
        }
      // Keep positions: a gap (a blank workbook row) stays as an empty record
      place(s, t.place)[t.key] = Array.from(rows, (r) => r ?? {});
    } else {
      for (const b of blocks)
        for (const [col, row] of Object.entries<any>(b[t.container ?? "Cols"] ?? {})) {
          const ownKey = t.memberKeys?.[col];
          const member = t.members === "as-is" ? col : t.members[col];
          if (!ownKey && !member) {
            unmapped.push(`${name} member ${col}`);
            continue;
          }
          for (const [field, v] of Object.entries(row ?? {})) {
            const target = colPath(t, ownKey, member, field);
            if (!target) unmapped.push(`${name}.${field}`);
            else if (!isEmpty(v)) setPath(place(s, target.place), target.path, readValue(target.format, v));
          }
        }
    }
  }
  if (unmapped.length && !lenient) throw new Error(`${spec.test}: not in the neutral spec: ${unmapped.join(", ")}`);
  return s;
};

/** Neutral scenario -> standalone fixture scenario (no ScenarioExtends). */
export const toVeerg = (spec: ModuleSpec, s: NeutralScenario): any => {
  const out: any = { ScenarioName: s.scenario.name };
  if (s.scenario.description) out.ScenarioDescription = s.scenario.description;
  if (s.scenario.notes) out.ScenarioNotes = s.scenario.notes;
  for (const c of spec.cells) {
    const v = getPath(c.place === "inputs" ? s.inputs : s[c.place], c.key);
    if (v !== undefined) out[c.cell] = writeValue(c, v);
  }
  out.InputTables = [];
  for (const t of spec.tables) {
    const src = t.place === "inputs" ? s.inputs : (s[t.place] as Record<string, any> | undefined);
    if (t.kind === "rows") {
      const rows: Record<string, Value>[] | undefined = src?.[t.key];
      if (!rows) continue;
      const Rows = Object.fromEntries(
        rows.map((r, i) => [`${t.rowPrefix}${i + 1}`, Object.fromEntries(t.fields.filter((f) => f.key in r).map((f) => [f.field, writeValue(f, r[f.key])]))]),
      );
      out.InputTables.push({ TableName: t.table, ...t.props, Rows });
    } else {
      const entries = colEntries(t, s);
      if (!entries.length) continue;
      const container = t.container ?? "Cols";
      const build = (keep: (col: string, field: string) => boolean) => {
        const m: Record<string, Record<string, Value>> = {};
        for (const [col, field, v] of entries) if (keep(col, field)) (m[col] ??= {})[field] = writeValue(formatFor(t, field), v);
        return m;
      };
      if (!t.blocks) out.InputTables.push({ TableName: t.table, ...t.props, [container]: build(() => true) });
      else
        for (const b of t.blocks) {
          const m = build((col, field) => (!b.fields || b.fields.includes(field)) && (!b.members || b.members.includes(col)));
          if (Object.keys(m).length) out.InputTables.push({ TableName: t.table, ...b.props, [container]: m });
        }
    }
  }
  return out;
};

// --- shared cell specs ------------------------------------------------------------------

/** Site cells (as src/neutral/site.ts): only the ones a fixture has are written back. */
export const SITE_CELLS: CellSpec[] = [
  { cell: "X_Cell_Site_StartDate", place: "site", key: "reporting period start date" },
  { cell: "X_Cell_Site_State", place: "site", key: "state" },
  { cell: "X_Cell_Site_Region", place: "site", key: "region" },
  {
    cell: "X_Cell_Site_LeachingZone",
    place: "site",
    key: "location in leaching zone",
    values: { "YES - In leaching zone": true, "NO - Not in leaching zone": false },
  },
  { cell: "X_Cell_Site_Elevation", place: "site", key: "elevation" },
  { cell: "X_Cell_Site_AverageTemperature", place: "site", key: "mean annual temperature" },
  { cell: "X_Cell_Site_TotalRainfall", place: "site", key: "total rainfall" },
  { cell: "X_Cell_Site_PotentialEvapotranspiration", place: "site", key: "potential evapotranspiration" },
  { cell: "X_Cell_Site_FrostDays", place: "site", key: "number of frost days" },
  { cell: "X_Cell_Site_FarmName", place: "workbook", key: "farm name" },
  { cell: "X_Cell_Site_ReportingEntityName", place: "workbook", key: "reporting entity name" },
];

/** Workbook site cells for a neutral scenario: what the adapters' site helpers (src/adapters/common.ts) read. */
export const siteCells = (s: NeutralScenario) =>
  Object.fromEntries(
    SITE_CELLS.filter((c) => c.place === "site" && getPath(s.site, c.key) !== undefined).map((c) => [c.cell, writeValue(c, getPath(s.site, c.key))]),
  );
