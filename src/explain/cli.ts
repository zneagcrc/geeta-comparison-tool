// Explanations for differences between a calculator and GEETA. Nothing here calls an LLM: explanations are written by Claude Code
// (or a person) on request, from an evidence bundle, and recorded with `add`. See CLAUDE.md for the workflow.
//
//   npm run explain -- status [Test]                   which differences are unexplained, stale or unreviewed
//   npm run explain -- bundle <Test>[:<Scenario>]      write an evidence bundle for an LLM to explain
//   npm run explain -- add <draft.json> [--force]      record an explanation (fingerprints and checks computed here)
//   npm run explain -- history <Test>[:<Scenario>]     every stored explanation for a test, including superseded ones
// Add --calculator <id> to work on another calculator's explanations (default: the workspace's calculator).
import fs from "node:fs";
import path from "node:path";
import { TEST_DIR, findTest, loadCases } from "../fixtures";
import { type CheckSpec, evaluateCheck, fmt } from "./checks";
import { diagnoseCase } from "./diagnose";
import { calculator } from "../calculators";
import { comparedResults } from "../calculators/types";
import { isExcluded } from "../comparison-config";
import { DOCS_DIR, chaptersOfResults, documentFor, listDocuments } from "./documents";
import { type DifferenceType, type ExplanationRecord, differenceTypes, loadStore, matches, saveStore, storeDir, storeFile } from "./store";
import { GEETA, TEST_EXCEL_DIR, geetaLabel } from "../geeta-source";
import { PACKAGE_ROOT, WORKSPACE } from "../workspace";

const ROOT = WORKSPACE;
const calc = calculator();
const { adapters } = calc;
const REQUESTS_DIR = path.join(storeDir(), "requests");
/** The GEETA folder: a downloaded release or a local GAF-VEERG-Functions working copy (geeta-source.ts). */
const GAF_DIR = GEETA.dir;

const [command, ...rest] = process.argv.slice(2);
const force = rest.includes("--force");
const args = rest.filter((a) => !a.startsWith("--"));

/** Every case of a test run through its adapter, with the adapter's console notes and the diagnosis. */
const runTest = (test: string, scenarioFilter?: string) => {
  const adapter = adapters[test];
  const entry = findTest(test);
  if (!adapter || !entry?.TestInputFile) throw new Error(`${test}: ${!adapter ? "no adapter" : "no test entry in Test.json"}`);
  return loadCases(entry)
    // Scenarios comparison.config.json excludes aren't compared, so they aren't explained either
    .filter((c) => (!scenarioFilter || c.name === scenarioFilter) && !isExcluded(test, c.name))
    .map((c) => {
      const notes: string[] = [];
      const { log, warn } = console;
      console.log = console.warn = (...a: unknown[]) => notes.push(a.map(String).join(" ").trim());
      let actual: Record<string, unknown> = {};
      let error: string | undefined;
      try {
        actual = adapter(c.input);
      } catch (e: any) {
        error = String(e?.message ?? e);
      } finally {
        console.log = log;
        console.warn = warn;
      }
      // A partial (enterprise) adapter is compared only on the results of the modules it maps
      const expected = comparedResults(adapter, c.expected);
      return { ...c, expected, actual, error, notes: [...new Set(notes)], diagnosis: diagnoseCase(test, c.name, c.input, expected, actual) };
    });
};

const parseTarget = (target: string | undefined) => {
  if (!target) throw new Error("Give a test, e.g. ManureManagement.Pigs or ManureManagement.Pigs:Default scenario");
  const [test, scenario] = target.split(/:(.*)/s);
  return { test, scenario: scenario || undefined };
};

// --- status ------------------------------------------------------------------------

const status = (only?: string) => {
  const rows: Record<string, unknown>[] = [];
  for (const test of only ? [only] : Object.keys(adapters))
    for (const c of runTest(test)) {
      const r = Object.values(c.diagnosis.results).filter((d) => d.differs);
      if (!r.length) continue;
      rows.push({
        test,
        scenario: c.name ?? "",
        differing: r.length,
        unexplained: r.filter((d) => !d.record).length,
        suspect: r.filter((d) => d.check && !d.check.ok).length,
        stale: r.filter((d) => d.review === "stale").length,
        unreviewed: r.filter((d) => d.review === "unreviewed").length,
      });
    }
  console.table(rows);
  console.log("Explain a test or scenario with: npm run explain -- bundle <Test>[:<Scenario>]");
};

// --- bundle ------------------------------------------------------------------------

const describeCheck = (c: CheckSpec | undefined) =>
  !c ? "none" : c.kind === "reproduces" ? `reproduces (${c.what})` : c.kind === "ratio" ? `ratio (${Object.keys(c.factors).join(" or ")})` : `bound ${c.lo}–${c.hi} (${c.what})`;

/**
 * The file that defines an adapter: <adapterDir>/<function name>.ts if there is one, else the first .ts file in the
 * adapter folder (searched recursively) that declares a function or constant of that name, e.g. `const fuel`.
 */
const findAdapterSource = (name: string): string => {
  const dir = path.join(ROOT, calc.adapterDir);
  const conventional = path.join(dir, `${name}.ts`);
  if (!name || fs.existsSync(conventional)) return conventional;
  const declares = new RegExp(`\\b(?:const|let|var|function)\\s+${name.replace(/[$]/g, "\\$")}\\b`);
  const walk = (d: string): string[] =>
    fs.existsSync(d)
      ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "node_modules" ? [] : walk(path.join(d, e.name))) : e.name.endsWith(".ts") ? [path.join(d, e.name)] : []))
      : [];
  return walk(dir).find((f) => declares.test(fs.readFileSync(f, "utf8"))) ?? conventional;
};

/** Source files worth reading for a test: its adapter (and local helpers), the calculator files it uses, the .xlf equations. */
const sources = (test: string) => {
  const adapterName = adapters[test].name;
  const adapterFile = findAdapterSource(adapterName);
  const files = new Set<string>([adapterFile]);
  const used = new Set<string>();
  const scan = (file: string) => {
    if (!fs.existsSync(file)) return;
    const src = fs.readFileSync(file, "utf8");
    for (const f of calc.sourceFiles?.(src) ?? []) used.add(f);
    // Local helpers the adapter imports (other adapters' helpers, the neutral scenario code), not the harness itself
    for (const m of src.matchAll(/from "(\.\.?\/[A-Za-z/]+)"/g)) {
      if (/\/(veerg|run-veerg-tests|fixtures|adapters|types|calculators)$/.test(m[1]) || m[1] === "..") continue;
      const helper = path.join(path.dirname(file), `${m[1]}.ts`);
      if (!files.has(helper)) {
        files.add(helper);
        scan(helper);
      }
    }
  };
  scan(adapterFile);
  const moduleDir = path.join(GAF_DIR, "Modules", ...test.split("."));
  const xlf = fs.existsSync(moduleDir) ? fs.readdirSync(moduleDir).filter((f) => f.endsWith(".xlf")).map((f) => path.join(moduleDir, f)) : [];
  return { adapters: [...files], calculator: [...used], xlf };
};

const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, "/");

const bundle = (target: string | undefined) => {
  const { test, scenario } = parseTarget(target);
  const cases = runTest(test, scenario);
  if (!cases.length) throw new Error(`No scenario "${scenario}" in ${test}`);
  const entry = findTest(test);
  const store = loadStore(test);
  const superseded = new Set(store.records.flatMap((r) => r.supersedes ?? []));
  const src = sources(test);
  const name = `${test}${scenario ? `__${scenario.replace(/[^A-Za-z0-9._-]+/g, "_")}` : ""}`;
  fs.mkdirSync(REQUESTS_DIR, { recursive: true });
  const inputsFile = path.join(REQUESTS_DIR, `${name}.inputs.json`);
  fs.writeFileSync(inputsFile, JSON.stringify(Object.fromEntries(cases.map((c) => [c.name ?? "", c.input])), null, 2) + "\n");

  const w: string[] = [];
  w.push(`# Explain: ${test}${scenario ? ` / ${scenario}` : ""}`, "");
  w.push(`Generated ${new Date().toISOString()} · ${calc.name} ${calc.version()} · store: ${rel(storeFile(test))}`, "");
  w.push("## Instructions", "");
  w.push(
    "1. **Read the stored explanations below first.** For each differing result, if its current explanation's check passes " +
      "and the review is `current`, it still holds: say so and move on. If it is `stale` or `unreviewed` but the check passes " +
      "and nothing in the evidence contradicts it, re-record it unchanged (same scope, note and check; `supersedes` the old id) " +
      "so it is current again.",
    `2. Otherwise diagnose from the evidence: the automatic findings, the adapter notes, the sources listed (${calc.name} files, ` +
      'the .xlf equations, the adapter). Follow the workflow in docs/diagnosing.md (in geeta-comparison-tool).',
    "   GEETA is the basis of the comparison. When sources disagree, the higher one decides: (1) the VEERG methodology " +
      `documents, (2) the .xlf equations and source data, (3) the GEETA workbooks, (4) ${calc.name}. ${calc.name}'s documentation ` +
      `says what ${calc.name} does, not what the methodology requires: where ${calc.name} models something differently from VEERG ` +
      "(its own seasons, periods, classes or defaults), it departs from the methodology. Where the adapter gave it its own model " +
      "instead of VEERG's, the difference is an `Adapter defect`. Don't leave the choice to the provider.",
    "3. Record each explanation with a draft JSON file and `npm run explain -- add <draft.json>` (format below). Give it a " +
      "numeric check wherever the numbers allow one: prefer `reproduces` (add a `PROBE:<result name>` value to the adapter " +
      "that recomputes the result with the cause corrected), then `ratio`, then `bound`. `add` refuses a draft whose check " +
      "fails on the current numbers.",
    "4. Cite what the explanation relies on in `sources`: the methodology document listed under Sources (by its version, " +
      `with the clause, equation or table), and any ${calc.name} file, workbook cell or source-data table. Cite only the methodology ` +
      "versions marked \"cite\", not the older ones listed beside them.",
    `5. Add or update the numbered section in ${calc.findings} and put its number in \`section\`.`,
    "",
    "Draft format (fields not listed are filled in by `add`):",
    "",
    "```json",
    JSON.stringify(
      {
        test,
        section: "14",
        type: `${calc.name} coverage gap`,
        scope: { scenario: "_(14|15)$", result: "^VEERG_4_5_1_1__" },
        note: "One line on the nature of the difference, for someone reading the results.",
        sources: ["Chapter 4 pre-release accepted (30 Sep 2026), 4.5.1.1 (1)", `${calc.name} <file>`],
        check: { kind: "reproduces", what: `${calc.name} with ... corrected` },
        model: "claude-opus-5-5",
        supersedes: ["<id of the record this replaces>"],
      },
      null,
      2,
    ),
    "```",
    "",
    `Types: ${differenceTypes().join(", ")}. ` +
      'Checks: `{ "kind": "reproduces", "what": "..." }`, `{ "kind": "ratio", "factors": { "label": 1.23 } }`, `{ "kind": "bound", "lo": 0.9, "hi": 1, "what": "..." }`.',
    "",
  );

  w.push(`## Stored explanations for ${test} (${store.records.length}, newest first)`, "");
  if (!store.records.length) w.push("None yet.", "");
  for (const r of [...store.records].sort((a, b) => b.created.localeCompare(a.created))) {
    w.push(
      `- **${r.id}**${superseded.has(r.id) ? " _(superseded)_" : ""} · ${r.created.slice(0, 10)} · ${r.author.kind === "llm" ? r.author.model : `human${r.author.name ? ` (${r.author.name})` : ""}`}` +
        `${r.origin ? ` · ${r.origin}` : ""} · section ${r.section ?? "—"} · ${r.type}`,
      `  - scope: scenario \`${r.scope.scenario ?? "(all)"}\`, result \`${r.scope.result ?? "(all)"}\``,
      `  - note: ${r.note}`,
      `  - check: ${describeCheck(r.check)}`,
      `  - sources: ${r.sources?.join("; ") || "— (not recorded)"}`,
      `  - written against: ${Object.keys(r.evidence).map((s) => s || "(no scenarios)").join(", ") || "—"}`,
    );
  }
  w.push("");

  for (const c of cases) {
    const differing = Object.entries(c.diagnosis.results).filter(([, d]) => d.differs);
    w.push(`## Scenario: ${c.name ?? "(no scenarios)"}`, "");
    w.push(`Evidence fingerprint: \`${c.diagnosis.fingerprint}\` · ${differing.length} of ${Object.keys(c.expected).length} results differ`, "");
    if (c.error) w.push(`**Adapter error:** ${c.error}`, "");
    if (c.notes.length) w.push("Adapter notes:", "", ...c.notes.map((n) => `- ${n}`), "");
    if (!differing.length) {
      w.push("All results match.", "");
      continue;
    }
    w.push(`| Result | GEETA | ${calc.name} | Probe | Automatic findings | Explanation | Check | Review |`, "|---|---:|---:|---:|---|---|---|---|");
    for (const [key, d] of differing) {
      const n = (x: unknown) => (typeof x === "number" ? fmt(x) : x === undefined ? "—" : String(x));
      w.push(
        `| ${key} | ${n(c.expected[key])} | ${n(c.actual[key])} | ${n(c.actual[`PROBE:${key}`])} | ${d.findings.map((f) => f.text).join("; ")} | ` +
          `${d.record ? `${d.record.id}` : "**none**"} | ${d.check ? `${d.check.ok ? "✓" : "✗"} ${d.check.detail}` : "—"} | ${d.review ?? "—"} |`,
      );
    }
    w.push("");
  }

  w.push("## Sources", "");
  w.push(`- Test set: ${geetaLabel()}`);
  w.push(`- Resolved inputs per scenario: ${rel(inputsFile)}`);
  w.push(`- Fixtures: ${rel(path.join(TEST_DIR, entry.TestInputFile))}, ${rel(path.join(TEST_DIR, entry.TestResultsFile))}`);
  w.push(`- Workbook: ${entry.TestExcelFile} (generated test copies in ${rel(TEST_EXCEL_DIR)})`);
  w.push(`- Adapter: ${src.adapters.map(rel).join(", ")}`);
  w.push(`- ${calc.name} files: ${src.calculator.map(rel).join(", ") || "—"}`);
  w.push(`- VEERG equations (.xlf): ${src.xlf.map(rel).join(", ") || "—"}`);
  // Methodology documents: the best available version of each chapter the results come from, plus Appendix A
  const docs = listDocuments();
  const chapters = [...chaptersOfResults(cases.flatMap((c) => Object.keys(c.expected))), "A"];
  const day = (d: Date) => d.toLocaleDateString("en-CA"); // local YYYY-MM-DD
  w.push(`- Methodology (VEERG documents; convert a .docx with \`python -I ${rel(path.join(PACKAGE_ROOT, "tools/docx2txt.py"))} <outdir> "<file>"\`, a .pdf with \`pdftotext -layout "<file>" <out.txt>\`):`);
  for (const ch of chapters) {
    const { use, others } = documentFor(ch, docs);
    const label = ch === "A" ? "Appendix A" : `Chapter ${ch}`;
    if (!use) {
      w.push(
        fs.existsSync(DOCS_DIR)
          ? `  - ${label}: no document found in ${rel(DOCS_DIR)}`
          : `  - ${label}: no VEERG documents folder (${rel(DOCS_DIR)}; set VEERG_DOCUMENTS_DIR or geeta.local.json "veergDocuments"). Cite the .xlf equation and the workbook cell instead, and quote nothing from the documents.`,
      );
      continue;
    }
    w.push(`  - ${label} (cite): ${rel(use.file)} · ${use.status} · ${day(use.modified)}`);
    for (const o of others) w.push(`    - older, don't cite: ${rel(o.file)} · ${o.status} · ${day(o.modified)}`);
  }
  w.push(`- Write-up: ${calc.findings}${store.records.some((r) => r.section) ? ` (sections ${[...new Set(store.records.map((r) => r.section).filter(Boolean))].join(", ")})` : ""}`);
  w.push("");

  const file = path.join(REQUESTS_DIR, `${name}.md`);
  fs.writeFileSync(file, w.join("\n"));
  console.log(`Wrote ${rel(file)}`);
  console.log(`Now ask Claude Code: "explain the differences in ${rel(file)}"`);
};

// --- add ---------------------------------------------------------------------------

type Draft = {
  test: string;
  section?: string;
  type: DifferenceType;
  scope?: { scenario?: string; result?: string };
  note: string;
  sources?: string[];
  check?: CheckSpec;
  model?: string;
  author?: string;
  origin?: string;
  supersedes?: string[];
};

/** Records an explanation: evidence fingerprints for every scenario it currently explains, and its check evaluated there. */
export const addRecord = (draft: Draft, opts: { force?: boolean; created?: string; quiet?: boolean } = {}) => {
  if (!adapters[draft.test]) throw new Error(`Unknown test ${draft.test}`);
  if (!draft.note || !draft.type) throw new Error("A draft needs at least test, type and note");
  if (!differenceTypes().includes(draft.type)) throw new Error(`Unknown type "${draft.type}" (have: ${differenceTypes().join(", ")})`);
  const scope = draft.scope ?? {};
  for (const re of [scope.scenario, scope.result]) if (re) new RegExp(re); // validates
  const store = loadStore(draft.test);
  const draftRecord = { scope } as ExplanationRecord;

  const evidence: Record<string, string> = {};
  const failures: string[] = [];
  let covered = 0;
  for (const c of runTest(draft.test)) {
    let hit = false;
    for (const [key, d] of Object.entries(c.diagnosis.results)) {
      if (!d.differs || !matches(draftRecord, c.name, key)) continue;
      hit = true;
      covered++;
      const geeta = c.expected[key];
      if (draft.check && typeof geeta === "number") {
        const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
        const r = evaluateCheck(draft.check, { geeta, calculated: num(c.actual[key]), probe: num(c.actual[`PROBE:${key}`]) });
        if (!r.ok) failures.push(`${c.name ?? ""} ${key}: ${r.detail}`);
      }
    }
    if (hit) evidence[c.name ?? ""] = c.diagnosis.fingerprint;
  }
  if (!covered) throw new Error("The scope matches no differing result");
  if (failures.length && !opts.force)
    throw new Error(`The check fails for ${failures.length} result(s) (use --force to record anyway):\n  ${failures.slice(0, 10).join("\n  ")}`);

  // A record with the same scope replaces the one before it
  const same = store.records.filter((r) => r.scope.scenario === scope.scenario && r.scope.result === scope.result).map((r) => r.id);
  // A single id written as a string is accepted (spreading it would split it into characters)
  const given = typeof draft.supersedes === "string" ? [draft.supersedes as string] : (draft.supersedes ?? []);
  const unknown = given.filter((id) => !store.records.some((r) => r.id === id));
  if (unknown.length) throw new Error(`supersedes names no stored record: ${unknown.join(", ")}`);
  const supersedes = [...new Set([...given, ...same])];
  const record: ExplanationRecord = {
    id: `${draft.test}-${String(store.records.length + 1).padStart(3, "0")}`,
    created: opts.created ?? new Date().toISOString(),
    author: draft.author ? { kind: "human", name: draft.author } : { kind: "llm", model: draft.model ?? "unknown" },
    ...(draft.origin ? { origin: draft.origin } : {}),
    ...(draft.section ? { section: draft.section } : {}),
    type: draft.type,
    scope,
    note: draft.note,
    ...(draft.sources?.length ? { sources: draft.sources } : {}),
    ...(draft.check ? { check: draft.check } : {}),
    evidence,
    ...(supersedes.length ? { supersedes } : {}),
  };
  saveStore({ ...store, records: [...store.records, record] });
  if (!opts.quiet)
    console.log(
      `Recorded ${record.id}: ${covered} differing result(s) in ${Object.keys(evidence).length} scenario(s)` +
        `${supersedes.length ? `, supersedes ${supersedes.join(", ")}` : ""}${failures.length ? `; check FAILS for ${failures.length} (forced)` : ""}`,
    );
  return record;
};

// --- history -----------------------------------------------------------------------

const showHistory = (target: string | undefined) => {
  const { test, scenario } = parseTarget(target);
  const store = loadStore(test);
  const superseded = new Set(store.records.flatMap((r) => r.supersedes ?? []));
  for (const r of [...store.records].reverse()) {
    if (scenario && r.scope.scenario && !new RegExp(r.scope.scenario).test(scenario)) continue;
    console.log(`${r.id}${superseded.has(r.id) ? " (superseded)" : ""}  ${r.created.slice(0, 10)}  #${r.section ?? "—"} ${r.type}`);
    console.log(`  scope: ${r.scope.scenario ?? "(all)"} / ${r.scope.result ?? "(all)"}`);
    console.log(`  ${r.note}`);
    console.log(`  check: ${describeCheck(r.check)}`);
    console.log(`  sources: ${r.sources?.join("; ") || "—"}\n`);
  }
};

if (require.main === module) {
  try {
    if (command === "status") status(args[0]);
    else if (command === "bundle") bundle(args[0]);
    else if (command === "add") addRecord(JSON.parse(fs.readFileSync(args[0], "utf8")), { force });
    else if (command === "history") showHistory(args[0]);
    else
      console.log(
        [
          "usage: npm run explain -- status [Test] | bundle <Test>[:<Scenario>] | add <draft.json> [--force] | history <Test>[:<Scenario>]",
          "",
          "examples:",
          "  npm run explain -- status",
          "  npm run explain -- status ManureManagement.Pigs",
          "  npm run explain -- bundle ManureManagement.Pigs",
          '  npm run explain -- bundle "ManureManagement.Pigs:NIRAlignment_4_5_ManureManagement_Pigs_03"',
          "  npm run explain -- history ManureManagement.Poultry",
          "  npm run explain -- add draft.json",
          "",
          "then ask Claude Code: explain the differences in explanations/requests/<bundle>.md (more in README.md)",
        ].join("\n"),
      );
  } catch (e: any) {
    console.error(e?.message ?? e);
    process.exitCode = 1;
  }
}

