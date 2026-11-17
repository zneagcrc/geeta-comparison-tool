// The GEETA test input format the neutral specs (src/neutral/modules, enterprise.ts, poultry.ts) are written in, and
// the translation to and from newer ones. The specs speak tooling contract 1 (VEERG_0.0.0.3): percent strings ("20%"),
// monthly tables keyed by month name ("January" or "January 2025"), and that release's field names. From tooling
// contract 2 (VEERG_0.0.0.4) a release ships Schemas/renames.json, which lists every change from 0.0.0.3 per input
// workbook; this file reads it, so the specs and the neutral format stay as they are:
//
//   toSpec(input)     a test input in the release's format -> the format the specs read
//   fromSpec(fixture) a fixture the specs wrote -> the release's format (what GEETA's test runner reads)
//
// Changes that aren't renames (new inputs, inputs that moved) are in the specs themselves, which accept both forms.
import fs from "node:fs";
import path from "node:path";
import { TEST_DIR } from "../geeta-source";

/** The release the specs were written against: renames.json must list the changes from it. */
const SPEC_RELEASE = "VEERG_0.0.0.3";

/** What a former percent input is now; "per-cent-number": the spec reads a plain number of per cent (30), now a fraction. */
type Unit = "fraction" | "percent" | "number" | "per-cent-number";
type TableChanges = {
  /** New field (or row) name -> the spec's. */
  names: Map<string, string>;
  /** Fields whose value was a percent string, by new name: what it is now. */
  units: Map<string, Unit>;
  /** Renames of the outer keys only (members or rows), new -> the spec's, where a field keeps the same name. */
  outer: Map<string, string>;
  /** Monthly keys: by calendar month name, or with a year ("January 2025"); new keys are Month1..Month12. */
  months?: { year?: string };
};
type SchemaChanges = { cells: Map<string, Unit>; removedCells: Set<string>; tables: Map<string, TableChanges> };
type Renames = { from: string; to: string; schemas: Record<string, any> };

/**
 * Renames renames.json doesn't list (it takes renames from the test files by position): in the manure destination
 * tables the destination "DirectApplication" became "DirectApplicationToSoil" (the Stage 2 system of that name, a
 * column of the same tables, kept its name).
 */
const UNLISTED_OUTER: { table: RegExp; names: Record<string, string> }[] = [
  { table: /_Destinations$/, names: { DirectApplicationToSoil: "DirectApplication" } },
];

/** Unit changes renames.json doesn't list: plain per cent numbers (30) that became fractions (0.3). */
const UNLISTED_UNITS: { table: RegExp; fields: string[]; unit: Unit }[] = [
  { table: /^X_Table_PastureBeef_ProportionCowsCalving_Method1$/, fields: ["Cows1To2Years", "Cows2To3Years", "CowsOver3Years"], unit: "per-cent-number" },
];

/** Tables that became cells (renames.json lists the table as removed and the cells as new). */
const TABLES_TO_CELLS: { table: string; props: Record<string, unknown>; cells: Record<string, { member: string; field: string; unit: Unit }> }[] = [
  {
    table: "X_Table_Dairy_MilkSolidAttributes",
    props: { MatrixType: "ColsToRows", ColumnOffset: null, RowOffset: null },
    cells: Object.fromEntries(
      ["Method1", "Method2"].flatMap((m) => [
        [`X_Cell_Dairy_MilkSolidsFatContent_${m}`, { member: m, field: "FatContent", unit: "percent" as Unit }],
        [`X_Cell_Dairy_MilkSolidsProteinContent_${m}`, { member: m, field: "ProteinContent", unit: "percent" as Unit }],
      ]),
    ),
  },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_KEY = /^(January|February|March|April|May|June|July|August|September|October|November|December)( \d{4})?$/;

let loaded: { renames?: Renames; tests: Map<string, string> } | undefined;
const load = () => {
  if (loaded) return loaded;
  const file = path.resolve(TEST_DIR, "../Schemas/renames.json");
  const renames: Renames | undefined = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : undefined;
  if (renames && renames.from !== SPEC_RELEASE)
    throw new Error(
      `${path.relative(process.cwd(), file)} lists the changes from ${renames.from}, but the neutral specs are written against ${SPEC_RELEASE}. Update geeta-comparison-tool.`,
    );
  // Test key ("ManureManagement.Pigs") -> its workbook (TestExcelFile, "4_5_ManureManagement_Pigs")
  const tests = new Map<string, string>();
  const testFile = path.join(TEST_DIR, "Test.json");
  if (renames && fs.existsSync(testFile)) {
    const walk = (o: any, p: string[]) => {
      if (o?.TestInputFile) tests.set(p.join("."), o.TestExcelFile ?? o.TestID);
      else for (const [k, v] of Object.entries(o ?? {})) if (v && typeof v === "object") walk(v, [...p, k]);
    };
    walk(JSON.parse(fs.readFileSync(testFile, "utf8")).Tests, []);
  }
  return (loaded = { renames, tests });
};

/** The renames.json entry for a test's workbook: "4_5_ManureManagement_Pigs" -> ManureManagement_Pigs. */
const schemaOf = (test: string): any => {
  const { renames, tests } = load();
  if (!renames) return undefined;
  const workbook = (tests.get(test) ?? test.replace(".", "_")).replace(/^\d+(_\d+)?_/, "");
  const names = Object.keys(renames.schemas);
  const name =
    names.find((n) => n === workbook) ??
    names.find((n) => n.startsWith(`${workbook}_`)) ?? // 14_Electricity -> Electricity_Scope2
    names.find((n) => n.replace(/Agricultural/, "Ag") === workbook);
  return name ? renames.schemas[name] : {};
};

const changesCache = new Map<string, SchemaChanges | undefined>();
const changesFor = (test: string): SchemaChanges | undefined => {
  if (changesCache.has(test)) return changesCache.get(test);
  const schema = schemaOf(test);
  let out: SchemaChanges | undefined;
  if (schema) {
    const unit = (u: any): Unit => (u?.to === "percent" ? "percent" : u?.to === "number" ? "number" : "fraction");
    const cells = new Map(Object.entries<any>(schema.cells?.unitChanged ?? {}).map(([c, u]) => [c, unit(u)]));
    const tables = new Map<string, TableChanges>();
    for (const [table, t] of Object.entries<any>(schema.tables ?? {})) {
      const names = new Map<string, string>();
      let months: TableChanges["months"];
      for (const [old, now] of Object.entries<string>({ ...t.renamed?.fields, ...t.renamed?.rows })) {
        const m = old.match(MONTH_KEY);
        // Some tables list both forms ("April" by the month rule, "April 2025" from the test files): the year wins
        if (m && /^Month\d+$/.test(now)) months = { year: m[2]?.trim() ?? months?.year };
        else names.set(now, old);
      }
      const outer = new Map(UNLISTED_OUTER.filter((u) => u.table.test(table)).flatMap((u) => Object.entries(u.names)));
      tables.set(table, { names, outer, units: new Map(Object.entries<any>(t.unitChanged ?? {}).map(([f, u]) => [f, unit(u)])), months });
    }
    out = { cells, removedCells: new Set<string>(schema.cells?.removed ?? []), tables };
  }
  changesCache.set(test, out);
  return out;
};

/** A table's changes, including the renames renames.json doesn't list. */
const tableChanges = (changes: SchemaChanges, table: string): TableChanges | undefined => {
  const listed = changes.tables.get(table);
  const units = UNLISTED_UNITS.filter((u) => u.table.test(table)).flatMap((u) => u.fields.map((f) => [f, u.unit] as const));
  if (listed) return units.length ? { ...listed, units: new Map([...listed.units, ...units]) } : listed;
  const outer = new Map(UNLISTED_OUTER.filter((u) => u.table.test(table)).flatMap((u) => Object.entries(u.names)));
  return outer.size || units.length ? { names: new Map(), outer, units: new Map(units) } : undefined;
};

/** The reporting period's first month (0 = January) from X_Cell_Site_StartDate: ISO, d/m/yyyy or an Excel serial. */
const startMonth = (input: any): number => {
  const v = input?.X_Cell_Site_StartDate;
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + v * 86400000).getUTCMonth();
  const s = String(v ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-\d{1,2}/);
  if (iso) return Number(iso[2]) - 1;
  const dmy = s.match(/^\d{1,2}\/(\d{1,2})\/\d{4}/);
  if (dmy) return Number(dmy[1]) - 1;
  return 0;
};

const isNumber = (v: unknown): v is number | string => typeof v === "number" || (typeof v === "string" && /^\s*-?\d+(\.\d+)?([eE]-?\d+)?\s*$/.test(v));
const round = (n: number, digits: number) => Number(n.toFixed(digits));

/** A number in the release's unit -> the percent string the specs read. */
const toPercentString = (v: unknown, unit: Unit): unknown => {
  if (!isNumber(v)) return v;
  const n = Number(v);
  if (unit === "per-cent-number") return round(n * 100, 8);
  return `${unit === "percent" ? n : round(n * 100, 8)}%`;
};
/** A percent string the specs wrote -> a number in the release's unit. */
const fromPercentString = (v: unknown, unit: Unit): unknown => {
  if (unit === "per-cent-number") return isNumber(v) ? round(Number(v) / 100, 10) : v;
  if (typeof v !== "string" || !/^\s*-?[\d.]+\s*%\s*$/.test(v)) return v;
  const p = parseFloat(v);
  return unit === "percent" ? p : round(p / 100, 10);
};

const renameKey = (key: string, t: TableChanges | undefined, start: number, toSpec: boolean, outer = false): string => {
  if (!t) return key;
  if (outer) {
    if (toSpec && t.outer.has(key)) return t.outer.get(key)!;
    if (!toSpec) for (const [now, old] of t.outer) if (old === key) return now;
  }
  if (toSpec) {
    const month = t.months && key.match(/^Month(\d+)$/);
    if (month) return `${MONTHS[(start + Number(month[1]) - 1) % 12]}${t.months!.year ? ` ${t.months!.year}` : ""}`;
    return t.names.get(key) ?? key;
  }
  const m = t.months && key.match(MONTH_KEY);
  if (m) return `Month${((MONTHS.indexOf(m[1]) - start + 12) % 12) + 1}`;
  for (const [now, old] of t.names) if (old === key) return now;
  return key;
};

const translate = (input: any, test: string, toSpec: boolean): any => {
  const changes = changesFor(test);
  if (!changes || !input || typeof input !== "object") return input;
  const start = startMonth(input);
  const out: any = {};
  const moved: any[] = [];
  for (const [k, v] of Object.entries<any>(input)) {
    const into = toSpec && TABLES_TO_CELLS.find((m) => m.cells[k]);
    if (into) {
      // A cell that was a table's entry: back into the table
      const { member, field, unit } = into.cells[k];
      let table = moved.find((t) => t.TableName === into.table);
      if (!table) moved.push((table = { TableName: into.table, ...into.props, Cols: {} }));
      (table.Cols[member] ??= {})[field] = toPercentString(v, unit);
      continue;
    }
    // An input the release removed, written blank by the specs: left out
    if (!toSpec && changes.removedCells.has(k) && (v === null || v === "" || v === undefined)) continue;
    const unit = changes.cells.get(k);
    out[k] = unit ? (toSpec ? toPercentString(v, unit) : fromPercentString(v, unit)) : v;
  }
  if (!toSpec && Array.isArray(input.InputTables))
    for (const table of input.InputTables) {
      const from = TABLES_TO_CELLS.find((m) => m.table === table.TableName);
      if (from)
        for (const [cell, { member, field, unit }] of Object.entries(from.cells)) {
          const v = table.Cols?.[member]?.[field];
          if (v !== undefined) out[cell] = fromPercentString(v, unit);
        }
    }
  if (Array.isArray(input.InputTables))
    out.InputTables = input.InputTables.filter((table: any) => toSpec || !TABLES_TO_CELLS.some((m) => m.table === table.TableName)).map((table: any) => {
      const t = tableChanges(changes, table.TableName);
      if (!t) return table;
      const copy: any = { ...table };
      for (const container of ["Rows", "Cols"])
        if (table[container] && typeof table[container] === "object")
          copy[container] = Object.fromEntries(
            Object.entries<any>(table[container]).map(([outer, fields]) => [
              renameKey(outer, t, start, toSpec, true),
              fields && typeof fields === "object"
                ? Object.fromEntries(
                    Object.entries<any>(fields).map(([field, v]) => {
                      // The unit list names fields (or, in a table keyed by row, rows) by their new names
                      const unit = t.units.get(field) ?? t.units.get(outer) ?? t.units.get(renameKey(field, t, start, false)) ?? t.units.get(renameKey(outer, t, start, false));
                      const value = unit ? (toSpec ? toPercentString(v, unit) : fromPercentString(v, unit)) : v;
                      return [renameKey(field, t, start, toSpec), value];
                    }),
                  )
                : fields,
            ]),
          );
      return copy;
    });
  if (moved.length) out.InputTables = [...(out.InputTables ?? []), ...moved];
  return out;
};

/** A test input in the release's format -> the format the neutral specs read (unchanged for a 0.0.0.3 test set). */
export const toSpec = (test: string, input: any) => translate(input, test, true);
/** A fixture the neutral specs wrote -> the release's format. */
export const fromSpec = (test: string, fixture: any) => translate(fixture, test, false);
/** A fixture field path ("Table.member.field", or a cell) in the release's names -> the specs' names. */
export const fieldToSpec = (test: string, field: string, input: any) => {
  const changes = changesFor(test);
  const [table, ...rest] = field.split(".");
  const t = changes && tableChanges(changes, table);
  if (!t || !rest.length) return field;
  const start = startMonth(input);
  return [table, ...rest.map((k, i) => renameKey(k, t, start, true, i === 0 && rest.length > 1))].join(".");
};
/** Whether the test set needs translating (it ships Schemas/renames.json). */
export const translated = () => !!load().renames;
