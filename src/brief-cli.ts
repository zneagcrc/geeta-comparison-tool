// geeta-compare brief <Test> [...] [--all] [--stdout]: the adapter brief of a test, everything an adapter needs to know
// from the GEETA side in one file, so whoever writes it (a person or an LLM) doesn't gather it from the release each
// time. For each neutral input: where it lands in the workbook (traced through the neutral format, as the docs' mapping
// is), the workbook's label, unit, type and options (InputFields), the VEERG catalogue entries for its symbol, the
// dimension members it comes in and the values the scenarios give it. Then the result names. No expected result
// values: the brief is safe to read while writing an adapter.
//
// Written to .geeta/briefs/<GEETA release>/<Test>.md (made again when missing or older than the tool or the test set);
// --stdout prints it instead, --force makes it again.
import fs from "node:fs";
import path from "node:path";
import { findTest, loadCases } from "./fixtures";
import { isExcluded } from "./comparison-config";
import { internalReason } from "./geeta-internal";
import { MODULES, moduleFor } from "./neutral/registry";
import { traceGeetaSide, type MappingRow } from "./docs/mapping";
import { GEETA, INPUT_FIELDS_DIR, TEST_DIR, geetaLabel, inputFieldsBaseName, requireTestSet } from "./geeta-source";
import { PACKAGE_ROOT, inWorkspace } from "./workspace";

type FieldDef = { label?: string; unit?: string; type?: string; options?: string[]; dependentOn?: string; optionsBy?: Record<string, string[]> };
type Catalogue = { section: string; ref: string; symbol: string; description: string; unit: string; kind: string; file: string }[];

const MAX_OPTIONS = 60;
const MAX_VALUES = 12;

/** The workbook's definition of each input cell and table field of a test (its InputFields file and the common one). */
const fieldDefs = (excelFile: string | undefined) => {
  const cells = new Map<string, FieldDef>();
  const tables = new Map<string, Map<string, FieldDef>>();
  const def = (d: any, label?: string): FieldDef => {
    const options = d?.Options && !d.DependentOn ? (Array.isArray(d.Options) ? d.Options.map(String) : Object.keys(d.Options)) : undefined;
    const optionsBy = d?.Options && d.DependentOn ? Object.fromEntries(Object.entries<any>(d.Options).map(([k, v]) => [k, Object.keys(v ?? {})])) : undefined;
    return { label: d?.Label ?? label, unit: d?.Unit, type: d?.CellType, options, dependentOn: d?.DependentOn, optionsBy };
  };
  for (const file of ["Common_InputFields.json", ...(excelFile ? [`${inputFieldsBaseName(excelFile)}_InputFields.json`] : [])]) {
    const p = path.join(INPUT_FIELDS_DIR, file);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
    for (const c of j.InputCells ?? []) if (c?.CellName && !cells.has(c.CellName)) cells.set(c.CellName, def(c));
    for (const t of j.InputTables ?? []) {
      if (!t?.TableName) continue;
      const fields = tables.get(t.TableName) ?? new Map<string, FieldDef>();
      tables.set(t.TableName, fields);
      for (const group of [t.Cols, t.Rows])
        for (const defs of Object.values<any>(group ?? {}))
          for (const [field, d] of Object.entries<any>(defs ?? {}))
            if (d && typeof d === "object" && !fields.has(field)) fields.set(field, def(d, t.ColumnNames?.[field]));
      for (const [field, label] of Object.entries<string>(t.ColumnNames ?? {})) if (!fields.has(field)) fields.set(field, { label });
    }
  }
  return { cells, tables };
};

/** A workbook field as the trace names it ("Table › member › Field" or a cell name), as a definition key. */
const defKey = (field: string) => {
  const parts = field.split(" › ");
  return parts.length === 3 ? `${parts[0]} › ${parts[2]}` : field;
};

const catalogue = (): Catalogue => JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "catalogue", "veerg-inputs.json"), "utf8"));

const show = (v: unknown) => (typeof v === "string" ? `"${v}"` : JSON.stringify(v));
const list = (xs: string[], max: number) => (xs.length > max ? `${xs.slice(0, max).join(", ")}, … (${xs.length} in all)` : xs.join(", "));

/** Paths of one input, with the positions that vary (dimension members, row numbers) written as <…>. */
const pattern = (paths: string[][]) => {
  const len = Math.max(...paths.map((p) => p.length));
  const varying: { at: number; values: string[] }[] = [];
  const parts = Array.from({ length: len }, (_, i) => {
    const values = [...new Set(paths.map((p) => p[i] ?? ""))];
    if (values.length === 1) return values[0];
    const rows = values.every((v) => /^\d+$/.test(v));
    if (!rows) varying.push({ at: i, values });
    return rows ? "[n]" : `<${varying.length}>`;
  });
  return { text: parts.join(" › "), varying };
};

const testEntry = (test: string) => {
  requireTestSet();
  const entry = findTest(test);
  if (!entry?.TestInputFile) throw new Error(`No test ${test} in this GEETA test set`);
  return entry;
};

/** Where a test's brief is kept: .geeta/briefs/<GEETA release>/<Test>.md in the workspace. */
export const briefFile = (test: string) => inWorkspace(".geeta", "briefs", GEETA.kind === "release" ? GEETA.release : "local", `${test}.md`);

/** The brief of a test, written to briefFile unless it is there already and newer than the tool and the test set. */
export const writeBrief = (test: string, { force = false } = {}): string => {
  const entry = testEntry(test);
  const out = briefFile(test);
  const inputsOf = [path.join(TEST_DIR, entry.TestInputFile), path.join(TEST_DIR, "Test.json"), __filename, path.join(PACKAGE_ROOT, "package.json")];
  const newest = Math.max(...inputsOf.filter((f) => fs.existsSync(f)).map((f) => fs.statSync(f).mtimeMs));
  if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs > newest) return out;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildBrief(test));
  return out;
};

/** The brief of a test, as Markdown. */
export const buildBrief = (test: string): string => {
  const entry = testEntry(test);
  const module = moduleFor(test);
  const cases = loadCases(entry).filter((c) => !isExcluded(test, c.name));
  const defs = fieldDefs(entry.TestExcelFile);
  const lines: string[] = [
    `# Adapter brief: ${test}`,
    "",
    `${geetaLabel()}, ${cases.length} scenario(s)${module ? `, VEERG section ${module.section}` : ""}. Made by \`npx geeta-compare brief ${test}\` from the ` +
      "release's test inputs, InputFields and the VEERG catalogue. It holds no expected results.",
    "",
  ];

  if (!module) {
    lines.push("This test has no neutral format, so its inputs aren't listed here: read them from the release (InputFields and the test's input file).", "");
  } else {
    // Every scenario's neutral inputs, with where GEETA's workbook takes each one
    const rows: { scenario: string; row: MappingRow }[] = [];
    for (const c of cases) {
      let neutral: any;
      try {
        neutral = module.fromVeerg(c.input);
      } catch {
        continue;
      }
      for (const row of traceGeetaSide(module, neutral)) rows.push({ scenario: String(c.name ?? "(default)"), row });
    }
    // One entry per workbook definition (or per input, for one the workbook doesn't take)
    const groups = new Map<string, { rows: MappingRow[]; scenarios: Set<string> }>();
    for (const { scenario, row } of rows) {
      const k = row.geeta.length ? defKey(row.geeta[0].field) : `(no workbook field) ${row.path.filter((p) => !/^\d+$/.test(p)).join(" › ")}`;
      const g = groups.get(k) ?? { rows: [], scenarios: new Set() };
      g.rows.push(row);
      g.scenarios.add(scenario);
      groups.set(k, g);
    }
    const cat = catalogue();
    const sectionNo = module.section.split(" ")[0];
    lines.push(
      "## Inputs",
      "",
      `${groups.size} inputs. Each gives the neutral path (\`<1>\`, \`<2>\`: dimension members, listed below it; \`[n]\`: a row), the workbook field ` +
        "it lands in with the workbook's own label, unit and options, the VEERG catalogue's definition, and the values the scenarios give it.",
      "",
    );
    for (const [k, g] of [...groups].sort(([, a], [, b]) => pattern(a.rows.map((r) => r.path)).text.localeCompare(pattern(b.rows.map((r) => r.path)).text))) {
      const p = pattern(g.rows.map((r) => r.path));
      lines.push(`### \`${p.text}\``, "");
      for (const v of p.varying) lines.push(`- <${p.varying.indexOf(v) + 1}>: ${list(v.values.map(show), 40)}`);
      const landings = [...new Set(g.rows.flatMap((r) => r.geeta.map((l) => defKey(l.field))))];
      const relations = [...new Set(g.rows.flatMap((r) => r.geeta.map((l) => l.relation).filter(Boolean)))];
      if (landings.length) lines.push(`- Workbook: ${landings.map((l) => `\`${l}\``).join(", ")}${relations.length ? ` (${relations.join(", ")})` : ""}`);
      const [table, field] = k.split(" › ");
      const d = field ? defs.tables.get(table)?.get(field) : defs.cells.get(k);
      if (d) {
        const about = [d.label && `"${d.label}"`, d.unit && `unit ${d.unit}`, d.type].filter(Boolean).join(", ");
        if (about) lines.push(`- Workbook definition: ${about}`);
        if (d.options?.length) lines.push(`- Options (${d.options.length}): ${list(d.options.map(show), MAX_OPTIONS)}`);
        if (d.optionsBy)
          for (const [parent, opts] of Object.entries(d.optionsBy)) lines.push(`- Options when ${d.dependentOn} is "${parent}" (${opts.length}): ${list(opts.map(show), MAX_OPTIONS)}`);
      }
      // Neutral inputs are named by their catalogue symbol or by its description, either with a note in brackets
      // ("E_gijy (CH4, t/ha burnt)")
      const names = new Set(
        p.text.split(" › ").flatMap((s) => {
          const bare = s.replace(/\s*\([^)]*\)$/, "");
          return [s, bare, bare.toLowerCase()];
        }),
      );
      const defsInCatalogue = cat.filter(
        (e) =>
          (names.has(e.symbol) || names.has(e.description.toLowerCase())) &&
          /^input/i.test(e.kind) &&
          // an enterprise covers several sections
          (!/^\d/.test(sectionNo) || e.section === sectionNo || e.section.startsWith(`${sectionNo}.`)),
      );
      for (const e of [...new Map(defsInCatalogue.map((e) => [`${e.symbol}|${e.description}|${e.unit}`, e])).values()].slice(0, 4)) {
        const refs = [...new Set(defsInCatalogue.filter((x) => x.symbol === e.symbol && x.description === e.description).map((x) => x.ref))];
        lines.push(`- VEERG: \`${e.symbol}\` ${e.description}${e.unit ? ` [${e.unit}]` : ""}, in ${list(refs, 6)} (\`Modules/${e.file}\`)`);
      }
      const values = [...new Set(g.rows.map((r) => show(r.value)))];
      lines.push(
        `- Values (${g.scenarios.size} of ${cases.length} scenarios): ${list(values, MAX_VALUES)}`,
        "",
      );
    }
  }

  // Result names, as `geeta-compare names` lists them
  const count = new Map<string, number>();
  // GEETA-internal results (geeta-internal.ts): only GEETA uses them, so a run doesn't compare them by default
  const internal = new Map<string, string>();
  for (const c of cases) {
    for (const k of Object.keys(c.expected ?? {})) count.set(k, (count.get(k) ?? 0) + 1);
    for (const k of Object.keys(c.expected ?? {})) {
      const reason = internalReason(c.internal, k);
      if (reason) internal.set(k, reason);
    }
  }
  lines.push("## Results", "", `${count.size} result names (the adapter returns each under this name, in GEETA's units):`, "");
  for (const [k, n] of count)
    lines.push(`- \`${k}\`${n < cases.length ? ` (in ${n} of ${cases.length} scenarios)` : ""}${internal.has(k) ? ` (GEETA internal: ${internal.get(k)}; not compared unless the run asks)` : ""}`);
  lines.push(
    "",
    "## Where else to look",
    "",
    `- The neutral scenarios themselves: \`npx geeta-compare neutral export ${test}\` (then \`scenarios/${module?.folder ?? "<module>"}/\`).`,
    "- The equations: the `.xlf` files named above, in the release's `Modules/`; the full catalogue in " +
      "`node_modules/geeta-comparison-tool/catalogue/veerg-inputs.md`.",
    "- Workbook formulas: `python -I node_modules/geeta-comparison-tool/tools/cellformula.py ...`.",
    "",
  );
  return lines.join("\n");
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const named = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--calculator");
  const tests = args.includes("--all") ? MODULES.map((m) => m.test).filter((t) => findTest(t)?.TestInputFile) : named;
  if (!tests.length) {
    console.error("Usage: geeta-compare brief <Test> [...] | --all [--stdout]   e.g. geeta-compare brief Fertiliser");
    process.exit(1);
  }
  try {
    for (const t of tests) {
      if (args.includes("--stdout")) process.stdout.write(buildBrief(t));
      else console.log(`Wrote ${path.relative(process.cwd(), writeBrief(t, { force: args.includes("--force") }))}`);
    }
  } catch (error: any) {
    console.error(error?.message ?? error);
    process.exit(1);
  }
}
