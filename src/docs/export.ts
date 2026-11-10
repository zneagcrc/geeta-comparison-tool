// Exports the GAF-VEERG test scenarios as a static HTML site and/or one Markdown document, with NIR, GEETA and the
// compared calculator's results side by side (--calculator <id>; written to the calculator's docsDir in the workspace). Ported from GAF-VEERG-Functions scripts/export-test-scenarios-html.ps1 and
// export-test-scenarios-doc.ps1 (see scenario-model.ts for what changed).
//
//   npx geeta-compare docs [--html <dir>] [--md <file>] [--test <TestID>] [--prefix <ScenarioPrefix>]
//                                [--modules-only | --enterprises-only]
//
// With neither --html nor --md, writes both to the defaults: docs/scenarios/html and docs/scenarios/TestScenarios.md.
// --prefix NIRAlignment exports the published subset (plus the base scenarios it builds on).
import fs from "node:fs";
import path from "node:path";
import { type InputTable, type ResultRow, type ScenarioPage, type TestModel, type Value, buildModel, calculatorVersion, slug } from "./scenario-model";
import { calculator } from "../calculators";
import { type Landing, type Mapping, mappingCacheFile } from "./mapping";
import { writeFindingsExclusions } from "../comparison-config";
import { geetaLabel } from "../geeta-source";
import type { DecisionUse } from "../mapping";
import { WORKSPACE } from "../workspace";

/** The geeta design system's dist/ folder: the installed package, or the copy a public release ships in vendor/. */
const designSystemDist = () => {
  try {
    return path.dirname(require.resolve("@zneagcrc/geeta-design-system"));
  } catch {
    return path.resolve(__dirname, "../../vendor/geeta-design-system");
  }
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const ROOT = WORKSPACE;
let htmlDir = option("--html");
let mdFile = option("--md");
if (!htmlDir && !mdFile) {
  htmlDir = path.join(ROOT, calculator().docsDir, "html");
  mdFile = path.join(ROOT, calculator().docsDir, "TestScenarios.md");
}

// Tests to document: named as `geeta-compare test` takes them (Fuel, ManureManagement.Pigs), or --test <TestID>
const WITH_VALUE = new Set(["--html", "--md", "--test", "--prefix", "--calculator"]);
const tests = [
  ...args.filter((a, i) => !a.startsWith("--") && !WITH_VALUE.has(args[i - 1] ?? "")),
  ...args.flatMap((a, i) => (a === "--test" && args[i + 1] ? [args[i + 1]] : [])),
];
console.error(`Building the scenario pages${tests.length ? ` for ${tests.join(", ")}` : ""} (mapping tables from ${mappingCacheFile(calculator())}).`);
const models = buildModel({
  tests,
  scenarioPrefix: option("--prefix"),
  modulesOnly: flag("--modules-only"),
  enterprisesOnly: flag("--enterprises-only"),
});
if (!models.length) throw new Error("No matching tests");

// The docs need the mapping traced first (geeta-compare mapping trace): nothing is written while any scenario shown
// has no current trace (never traced, or its adapter input or the calculator version changed since)
const untraced = models.filter((t) => t.pages.some((p) => p.mapping === null));
if (untraced.length) {
  const count = untraced.reduce((n, t) => n + t.pages.filter((p) => p.mapping === null).length, 0);
  console.error(
    [
      `The mapping isn't ready: ${count} scenario(s) in ${untraced.length} test(s) have no current trace (never traced, or the adapter or ${calculator().name} version changed since):`,
      `  ${untraced.map((t) => t.key).join(", ")}`,
      `Trace them first, then run docs again (nothing was written):`,
      `  npx geeta-compare mapping trace${tests.length ? ` ${untraced.map((t) => t.key).join(" ")}` : ""}`,
    ].join("\n"),
  );
  process.exit(1);
}

const generated = new Date().toISOString().slice(0, 16).replace("T", " ");
const version = calculatorVersion();
/** The calculator's name, as columns and headings show it. */
const C = calculator().name;
const prefix = option("--prefix");

const COLUMNS = {
  NIR: "National Inventory Report result (from the scenario's TestResults file)",
  GEETA: "Expected result from the GEETA (VEERG) workbook",
  [C]: `Result from ${C}${version ? ` ${version}` : ""}`,
  "Automatic findings":
    "Deterministic facts from the numbers alone (no LLM): exact factor signatures such as ×100 or ×265, values not calculated, differences confined to one method, one ratio shared across the scenario",
  "LLM explanation":
    `The stored explanation for this difference (explanations/${calculator().id}/<test>.json), written by an LLM on request and matched to results by test, scenario and result name; #n is the section in ${calculator().findings}. Marked stale when the evidence has changed since it was written, unreviewed when it was never written against this scenario`,
  Check:
    `Deterministic check that the numbers fit the explanation: reproduces (${C} recomputed with the cause corrected equals GEETA), ratio (${C} / GEETA equals the factor the cause implies) or bound (direction and rough size only)`,
};

// --- values -----------------------------------------------------------------------

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && !v.trim());

/** Results to 6 significant figures; inputs as written. */
const formatResult = (v: unknown) => (typeof v === "number" ? String(Number(v.toPrecision(6))) : String(v));
const formatInput = (v: unknown) => (typeof v === "boolean" ? String(v) : String(v));

const calcCount = (pages: ScenarioPage[]) => {
  let match = 0;
  let total = 0;
  let unexplained = 0;
  let verified = 0;
  let suspect = 0;
  let outdated = 0;
  for (const p of pages)
    for (const r of p.results)
      if (p.calc.status === "ok" && r.compared && r.geeta.value !== undefined) {
        total++;
        if (!r.calcDiffers) match++;
        else if (!r.record) unexplained++;
        else if (r.check?.ok) verified++;
        else if (r.check) suspect++;
        if (r.calcDiffers && r.review && r.review !== "current") outdated++;
      }
  return { match, total, unexplained, verified, suspect, outdated };
};

/** The Check column text, or "" when there is nothing to check. */
const checkText = (r: ResultRow) =>
  !r.calcDiffers || !r.record
    ? ""
    : !r.check
      ? "No numeric check"
      : `${r.check.ok ? "✓" : "✗ Suspect:"} ${r.check.kind}: ${r.check.detail}`;

/** Who wrote a stored explanation and when, e.g. "claude-opus-5-5, 2026-10-14". */
const provenance = (r: NonNullable<ResultRow["record"]>) =>
  `${r.author.kind === "llm" ? r.author.model : `${r.author.name ?? "human"}`}, ${r.created.slice(0, 10)}`;

/** The LLM explanation column text: "#15 <name> defect: ... (model, date)", "Unexplained", or "" when the calculator matches. */
const differenceText = (r: ResultRow) =>
  !r.calcDiffers
    ? ""
    : r.record
      ? `#${r.record.section ?? r.record.id} ${r.record.type}: ${r.record.note} (${provenance(r.record)}${r.review && r.review !== "current" ? `; ${r.review}` : ""})`
      : "Unexplained";

/** The Automatic findings column text. */
const findingsText = (r: ResultRow) => (r.calcDiffers ? r.findings.map((f) => f.text).join("; ") : "");

// --- HTML -------------------------------------------------------------------------

const he = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const td = (v: Value, format: (v: unknown) => string, extra: string[] = []) => {
  const cls = ["val", ...(v.changed ? ["changed-value"] : []), ...extra];
  if (isEmpty(v.value)) return `<td class="${[...cls, "empty"].join(" ")}">&mdash;</td>`;
  const text = format(v.value);
  if (typeof v.value === "number" || /^-?\d+(\.\d+)?([eE][-+]?\d+)?%?$/.test(text)) cls.push("num");
  const title = typeof v.value === "number" && text !== String(v.value) ? ` title="${he(v.value)}"` : "";
  return `<td class="${cls.join(" ")}"${title}>${he(text)}</td>`;
};

// This tool's own styles, loaded after the geeta design system (geeta/geeta.css: fonts, tokens, components). The page
// shell follows the Figma frame "Geeta compare" (file KRXa8aNV4VOdDUkcLbFQao, node 23:910); everything without a
// Figma design yet only takes the design system's fonts and colours. Use its tokens, not literal colours.
const STYLESHEET = `body{font-size:var(--font-size-paragraph);line-height:1.5;background:var(--surface-panel)}
a{color:var(--paddock-green);text-decoration:none}a:hover{text-decoration:underline}
h1,h2,h3{font-family:var(--font-display);font-weight:400;color:var(--text-primary)}
h4,h5{font-family:var(--font-body);font-weight:700;color:var(--text-primary)}
code{font-size:.95em}

/* --- page shell (Figma: Geeta compare): top bar, a 1px rule, then the content on Fleece white --- */
.top-bar{flex:none;padding-left:5px}
.brand{gap:6px}
.brand-mark{position:relative;width:35px;height:13.2375px}
.brand-mark__circle{position:absolute;left:0;top:0}
.brand-mark__bar{position:absolute;left:14.88px;width:4.766px;height:1.493px;background:var(--pasture-green)}
.brand-mark__bar:first-of-type{top:4.21px}
.brand-mark__bar+.brand-mark__bar{top:7.54px}
.brand-mark__square{position:absolute;left:21.29px;top:0;width:13.2375px;height:13.2375px;background:var(--paddock-green)}
.top-bar-rule{display:block;flex:none;width:100%;height:1px}
.page{padding:var(--space-32)}
.page>.container-content{min-width:600px;padding-inline:0}

/* --- scenario page: top bar over three independently scrolling columns (sidebar | inputs | results) --- */
body.scenario{height:100vh;display:flex;flex-direction:column;overflow:hidden}
.scenario-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:row}
.sidebar{flex:0 0 20rem;min-width:0;overflow-y:auto;border-right:1px solid var(--border-divider);padding:.7rem .9rem;background:var(--surface-panel)}
.sidebar .crumbs{font-size:var(--font-size-small);color:var(--text-secondary)}
.sidebar .scennav{font-size:13px;margin-bottom:.5rem}
.sidebar .scennav a{margin-right:.9rem;white-space:nowrap}
.sidebar .meta{margin-top:.5rem;font-size:var(--font-size-small);color:var(--text-primary)}
.sidebar .meta .scentitle{font-family:var(--font-display);font-size:var(--font-size-section);color:var(--brand-deep);margin-bottom:.35rem;word-break:break-word}
.sidebar .meta .tag{display:block;margin:.3rem 0}
.sidebar .meta .desc{font-style:italic;color:var(--text-secondary);margin:.3rem 0}
.sidebar .meta ul{margin:.3rem 0 0;padding-left:1.1rem}
.sidebar .legend dt{font-weight:700;margin-top:.3rem}
.sidebar .legend dd{margin:0 0 0 .8rem;color:var(--text-secondary)}
.panes{flex:1 1 auto;display:flex;min-width:0}
.pane{flex:1 1 50%;min-width:0;overflow-y:auto;padding:1rem 1.15rem;background:var(--surface-field)}
.pane.inputs{flex:0 0 var(--inputs-w,50%);min-width:12rem}
.pane.results{flex:1 1 auto;min-width:12rem}
.gutter{flex:0 0 7px;cursor:col-resize;background:var(--neutral-light);border-left:1px solid var(--border-divider);border-right:1px solid var(--border-divider)}
.gutter:hover,.gutter.dragging{background:var(--neutral-mid-light)}
body.scenario.resizing{cursor:col-resize}
body.scenario.resizing *{user-select:none}
.pane h2{margin:.1rem 0 .8rem;font-size:var(--font-size-heading-3);color:var(--brand-deep)}
.pane h3{margin:1.3rem 0 .5rem;font-size:var(--font-size-section);border-bottom:1px solid var(--border-section);padding-bottom:.2rem}
.pane h4{margin:1rem 0 .35rem;font-size:13px}
.pane h4 .flags{font-weight:400;color:var(--earth-red);font-size:var(--font-size-small)}
.note{color:var(--text-secondary);font-size:var(--font-size-small)}
.inputnav{position:sticky;top:-1rem;background:var(--surface-field);padding:.3rem 0 .4rem;margin:-.4rem 0 .4rem;border-bottom:1px solid var(--border-divider);z-index:1;font-family:var(--font-display);font-size:var(--font-size-control)}
.inputnav a{margin-right:1rem}
details.inset{margin:0 0 1rem}
details.inset>summary{cursor:pointer;font-family:var(--font-display);font-size:var(--font-size-section);color:var(--paddock-green);padding:.35rem .5rem;background:var(--surface-panel);border-radius:var(--radius-small)}
ul.jt{list-style:none;margin:.15rem 0 .15rem .2rem;padding-left:.9rem;border-left:1px solid var(--border-divider);font-size:var(--font-size-small)}
ul.jt li{margin:.08rem 0}
ul.jt summary{cursor:pointer}
.jk{color:var(--text-secondary)}
.jv{font-variant-numeric:tabular-nums;color:var(--text-primary);font-weight:700}
.jv.empty{color:var(--neutral-mid-light);font-weight:400}
.calc-notes{font-size:var(--font-size-small);color:var(--text-secondary);margin:.3rem 0 .8rem;padding-left:1.1rem}

/* --- tables (both page types) --- */
table{border-collapse:collapse;width:100%;margin:.2rem 0 .6rem;font-size:var(--font-size-small);background:var(--surface-field)}
th,td{border:1px solid var(--neutral-light);padding:4px 8px;text-align:left;vertical-align:top}
th{background:var(--fleece-white);font-weight:700}
.pane th{position:sticky;top:0}
td.num{text-align:right;font-variant-numeric:tabular-nums}
td.empty{color:var(--neutral-mid-light);text-align:center}
/* differs from the scenario this one extends (inputs and NIR/GEETA results) */
td.changed-value{background:var(--status-attention-surface);box-shadow:inset 3px 0 0 var(--status-attention-border);font-weight:700}
td.changed-value.empty{color:var(--earth-red)}
table.mapping{width:100%}
table.mapping td{vertical-align:top}
table.mapping tr.mgroup th{background:var(--surface-panel);text-align:left;position:static}
table.mapping .mval{font-variant-numeric:tabular-nums;white-space:nowrap}
.mschema{color:var(--neutral-mid-light);font-size:var(--font-size-fine)}
.mrel{display:inline-block;min-width:1.6em;padding:0 .3em;border-radius:3px;background:var(--green-light);color:var(--paddock-green);font-size:var(--font-size-fine);font-weight:700;text-align:center}
.mrel.derived{background:var(--blue-light);color:var(--blue-dark)}
td.munused{color:var(--earth-red);font-style:italic}
td.muntraced{color:var(--neutral-mid-light);font-style:italic}
/* Mapping filter: the design system's button group, sized to its content */
.mfilter{margin:.4rem 0 .6rem;display:inline-flex;flex-wrap:wrap}
.mfilter button{flex:none}
details.mmore>summary{cursor:pointer;color:var(--paddock-green);font-size:var(--font-size-small)}
/* NIR or calculator result that differs from GEETA */
td.differs{background:var(--status-error-surface);color:var(--status-error);box-shadow:inset -3px 0 0 var(--status-error)}
.rowhdr{font-weight:700;background:var(--fleece-white)}
table.results th.col{width:7.5rem}
td.difference{font-size:var(--font-size-small);color:var(--text-primary);min-width:14rem}
td.difference .diff-ref{font-weight:700;color:var(--status-error)}
td.difference .diff-type{display:inline-block;font-size:var(--font-size-fine);font-weight:700;color:var(--text-secondary);background:var(--fleece-white);border-radius:3px;padding:0 4px;margin-right:.2rem}
td.difference.unexplained{color:var(--status-error);font-weight:700}
td.difference .prov{display:block;margin-top:.15rem;font-size:var(--font-size-fine);color:var(--neutral-mid-light)}
td.difference .review{display:inline-block;font-size:var(--font-size-fine);font-weight:700;color:var(--earth-red);background:var(--status-attention-surface);border-radius:3px;padding:0 4px;margin-left:.3rem}
td.findings{font-size:var(--font-size-fine);color:var(--text-primary);min-width:10rem}
td.findings div+div{margin-top:.15rem}
td.check{font-size:var(--font-size-fine);color:var(--text-secondary);min-width:10rem}
td.check .verdict{font-weight:700;margin-right:.25rem}
td.check.ok .verdict{color:var(--paddock-green)}
td.check.suspect{background:var(--status-error-surface)}
td.check.suspect .verdict{color:var(--status-error)}
td.check.none{color:var(--neutral-mid-light);font-style:italic}
table.decisions tr.gap td{background:var(--status-error-surface);color:var(--status-error)}
table.decisions tr.proposed td{background:var(--status-attention-surface)}

/* --- index page --- */
body.index h1{font-size:var(--font-size-heading-2);margin:0 0 .3rem;color:var(--brand-deep)}
body.index .sub{color:var(--text-secondary);font-size:13px;margin-bottom:1.5rem}
body.index h2{font-size:var(--font-size-heading-3);margin:1.6rem 0 .3rem;border-bottom:1px solid var(--border-section);padding-bottom:.2rem}
body.index h2 small{font-family:var(--font-body);color:var(--text-secondary);font-size:var(--font-size-small)}
body.index ul{margin:.3rem 0 0;padding-left:1.3rem}
body.index li{margin:.15rem 0}
body.index li .idesc{color:var(--text-secondary);font-size:var(--font-size-small);line-height:1.45;display:inline-block}
body.index li .idesc::before{content:"\\2014\\00a0";color:var(--neutral-mid-light)}
body.index .count{font-family:var(--font-body);font-size:var(--font-size-small);color:var(--text-secondary);margin-left:.5rem}
body.index .count.off{color:var(--status-error)}
@media (max-width:640px){
  body.index li{margin:.45rem 0}
  body.index li .idesc{display:block;margin-left:.2rem}
  body.index li .idesc::before{content:none}
}
/* --- index dashboard --- */
.dashboard{margin:0 0 1.5rem}
.dashboard h2{margin-top:0}
.dashboard h3{font-size:var(--font-size-section);margin:1.2rem 0 .4rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.6rem}
.tile{border:1px solid var(--status-success-border);border-radius:var(--radius-field);padding:.6rem .8rem;background:var(--status-success-surface)}
.tile b{display:block;font-family:var(--font-display);font-size:var(--font-size-heading-3);font-weight:400;font-variant-numeric:tabular-nums;color:var(--paddock-green)}
.tile span{font-size:var(--font-size-small);color:var(--text-secondary)}
.tile.off{border-color:var(--status-error);background:var(--status-error-surface)}
.tile.off b{color:var(--status-error)}
table.failing td.test{font-weight:700;background:var(--fleece-white)}
table.failing td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.chip{display:inline-block;font-size:var(--font-size-fine);background:var(--fleece-white);border-radius:3px;padding:1px 6px;margin:1px 0;cursor:help;white-space:nowrap}
.chip b{color:var(--status-error)}
.chip.unexplained{background:var(--status-error-surface);color:var(--status-error);font-weight:700}
.chip .mark{margin-left:.3rem;font-weight:700}
.chip .mark.ok{color:var(--paddock-green)}
.chip .mark.stale{color:var(--earth-red)}
.chip.suspect{background:var(--status-error-surface);outline:1px solid var(--status-error)}
.chip .mark.none{color:var(--neutral-mid-light)}
body.index h2.all{font-size:var(--font-size-heading-2);border-bottom:1px solid var(--border-section)}
.desc{color:var(--text-secondary);font-style:italic}
.base{color:var(--earth-red);font-size:var(--font-size-small);font-weight:700;margin-right:.3rem}

@media (max-width:1000px){
  body.scenario{height:auto;overflow:auto}
  .scenario-body{flex-direction:column}
  .sidebar{flex:none;overflow:visible;border-right:none;border-bottom:1px solid var(--border-divider)}
  .panes{flex-direction:column}
  .pane{height:auto;overflow:visible;border-bottom:1px solid var(--border-divider)}
  .pane.inputs,.pane.results{flex:none;min-width:0}
  .gutter{display:none}
  .pane th{position:static}
}
`;

/** The design system package (fonts, tokens, components), copied to <html dir>/geeta/ beside the pages. */
const DESIGN_SYSTEM = designSystemDist();
/** This tool's own assets from the Figma frame (the brand mark circle, the rule under the top bar). */
const ASSETS = path.join(__dirname, "assets");

/** <head> stylesheets: the design system first, then this tool's styles, then the user's overrides. */
const headLinks = (root: string) =>
  `<link rel="stylesheet" href="${root}geeta/geeta.css">
<link rel="stylesheet" href="${root}styles.css">
<link rel="stylesheet" href="${root}custom.css">`;

/** The top bar (Figma: Geeta compare, node 23:910) and the 1px rule under it. root: the path back to index.html's folder. */
const topBar = (root: string) => `<header class="top-bar">
<a class="brand" href="${root}index.html">
<span class="brand__logo brand-mark" aria-hidden="true"><img class="brand-mark__circle" src="${root}assets/brand-circle.svg" width="13.2375" height="13.2375" alt=""><span class="brand-mark__bar"></span><span class="brand-mark__bar"></span><span class="brand-mark__square"></span></span>
<span class="brand__name">geeta compare</span>
</a>
<img class="top-bar__org-logo" src="${root}geeta/brand/zneag-logo.png" width="81" height="25" alt="zneag">
</header>
<img class="top-bar-rule" src="${root}assets/top-bar-rule.svg" width="1513.31" height="1" alt="">`;

const GUTTER_SCRIPT = `<script>
(function(){
  var panes=document.querySelector('.panes'),gut=document.querySelector('.gutter');
  if(!panes||!gut)return;
  var KEY='veerg-inputs-w',dragging=false;
  try{var s=localStorage.getItem(KEY);if(s)panes.style.setProperty('--inputs-w',s);}catch(e){}
  function px(e){return e.touches?e.touches[0].clientX:e.clientX;}
  function move(e){
    if(!dragging)return;
    var r=panes.getBoundingClientRect(),pct=Math.min(85,Math.max(15,(px(e)-r.left)/r.width*100));
    panes.style.setProperty('--inputs-w',pct.toFixed(2)+'%');
    e.preventDefault();
  }
  function stop(){
    if(!dragging)return;
    dragging=false;document.body.classList.remove('resizing');gut.classList.remove('dragging');
    try{localStorage.setItem(KEY,panes.style.getPropertyValue('--inputs-w'));}catch(e){}
  }
  function start(e){dragging=true;document.body.classList.add('resizing');gut.classList.add('dragging');e.preventDefault();}
  gut.addEventListener('mousedown',start);
  gut.addEventListener('touchstart',start,{passive:false});
  window.addEventListener('mousemove',move);
  window.addEventListener('touchmove',move,{passive:false});
  window.addEventListener('mouseup',stop);
  window.addEventListener('touchend',stop);
  gut.addEventListener('dblclick',function(){
    panes.style.removeProperty('--inputs-w');
    try{localStorage.removeItem(KEY);}catch(e){}
  });
})();
</script>`;

/** A value with a single "value" key (an input wrapper) shown as the value itself. */
const unwrap = (v: unknown): unknown =>
  v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 1 && "value" in v ? (v as { value: unknown }).value : v;
const isLeaf = (v: unknown) => v === null || typeof v !== "object";

/** Nested data (neutral scenario, calculator input) as an expandable key / value tree; the first levels open. */
const jsonTree = (value: unknown, depth = 0, openDepth = 1): string => {
  const v = unwrap(value);
  if (isLeaf(v)) return `<span class="jv">${v === null || v === undefined ? "&mdash;" : he(formatInput(v))}</span>`;
  const entries: [string, unknown][] = Array.isArray(v) ? v.map((x, i) => [`${i + 1}`, x]) : Object.entries(v as object);
  if (!entries.length) return `<span class="jv empty">(none)</span>`;
  return `<ul class="jt">${entries
    .map(([k, x]) => {
      const u = unwrap(x);
      return isLeaf(u)
        ? `<li><span class="jk">${he(k)}</span> ${jsonTree(u)}</li>`
        : `<li><details${depth < openDepth ? " open" : ""}><summary><span class="jk">${he(k)}</span></summary>${jsonTree(u, depth + 1, openDepth)}</details></li>`;
    })
    .join("")}</ul>`;
};

// --- mapping: how each neutral input reaches GEETA and the calculator ---------------------------------------------

/** "Schema › a › b › value" -> the path without the { value } wrapper, the schema (or table) dimmed. */
const landingField = (field: string, calculatorSide: boolean) => {
  const parts = field.split(" › ");
  if (calculatorSide && parts.length > 1 && parts[parts.length - 1] === "value") parts.pop();
  return parts.length > 1 ? `<span class="mschema">${he(parts[0])}</span> ${he(parts.slice(1).join(" › "))}` : he(field);
};

const RELATION_TITLE: Record<string, string> = {
  "=": "copied as is",
  "÷1000": "divided by 1000 (e.g. L to kL, kg to t)",
  "×1000": "multiplied by 1000 (e.g. t to kg)",
  "÷100": "divided by 100",
  "×100": "multiplied by 100 (fraction to percentage)",
  "as %": "written as a percentage",
  "↦": "looked up: written as the other side's code or name",
};
const htmlLanding = (l: Landing, calculatorSide: boolean) => {
  const title = l.relation ? (RELATION_TITLE[l.relation] ?? l.relation) : "derived: calculated from this input (and possibly others)";
  return `<div><span class="mrel${l.relation ? "" : " derived"}" title="${he(title)}">${he(l.relation ?? "ƒ")}</span> ${landingField(l.field, calculatorSide)}</div>`;
};
const htmlLandings = (ls: Landing[], calculatorSide: boolean, empty: string) => {
  if (!ls.length) return `<td class="munused">${empty}</td>`;
  const more =
    ls.length > 4
      ? `<details class="mmore"><summary>${ls.length - 4} more</summary>${ls.slice(4).map((l) => htmlLanding(l, calculatorSide)).join("")}</details>`
      : "";
  return `<td>${ls.slice(0, 4).map((l) => htmlLanding(l, calculatorSide)).join("")}${more}</td>`;
};

const FILTER_SCRIPT = `<script>(function(){var s=document.currentScript.parentNode,f=s.querySelector('.mfilter'),t=s.querySelector('table.mapping');if(!f||!t)return;f.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;f.querySelectorAll('button').forEach(function(x){x.classList.toggle('is-selected',x===b);x.setAttribute('aria-pressed',String(x===b))});var k=b.dataset.show;t.querySelectorAll('tr[data-kind]').forEach(function(r){r.hidden=k!=='all'&&r.dataset.kind!==k});t.querySelectorAll('tr.mgroup').forEach(function(g){var n=g.nextElementSibling,any=false;while(n&&!n.classList.contains('mgroup')){if(!n.hidden)any=true;n=n.nextElementSibling}g.hidden=!any})})})();</script>`;

/**
 * A mapping row's group (the site, a neutral input, or for an enterprise a module's input or a workbook table) and its
 * label within the group (members, rows).
 */
const mappingGroup = (p: string[]): { group: string; label: string[] } => {
  const [part, a, b, c, ...rest] = p;
  if (part === "site") return { group: "Site", label: p.slice(1) };
  if (part === "modules") return b === "inputs" ? { group: `${a} › ${c}`, label: rest } : { group: `${a} › ${b}: ${c}`, label: rest };
  if (part === "workbook" && a === "tables") return { group: `Workbook table (not in a neutral format yet): ${b}`, label: rest };
  if (part === "workbook" && a === "calculated") return { group: `Calculated by the workbook: ${b}`, label: rest };
  if (part === "workbook" && a === "cells") return { group: "Workbook cells (not in a neutral format yet)", label: [b] };
  if (part === "workbook") return { group: `Workbook: ${a}`, label: [b, c, ...rest].filter((x) => x !== undefined) };
  return { group: a, label: [b, c, ...rest].filter((x) => x !== undefined) };
};

const htmlMapping = (m: Mapping | null | undefined) => {
  if (m === null)
    return `<p class="note">Not traced (npx geeta-compare mapping trace).</p>`;
  if (!m) return `<p class="note">No neutral format for this test, so no mapping.</p>`;
  type Row = Mapping["rows"][number];
  const untraced = (r: Row) => !m.calculatorTraced || /^(every|no other)/.test(r.note ?? "");
  const kind = (r: Row) => (untraced(r) ? "untraced" : r.calculator.length ? (r.geeta.length ? "both" : "calc") : "geeta");
  const counts: Record<string, number> = { both: 0, geeta: 0, calc: 0, untraced: 0 };
  for (const r of m.rows) counts[kind(r)]++;
  const out: string[] = [];
  out.push(
    `<p class="note">Each neutral input and where it lands in the GEETA workbook input and in ${he(C)}'s input. Traced, not declared: each input is changed in turn and the workbook fixture and ${he(C)}'s inputs are regenerated (src/docs/mapping.ts). <span class="mrel">=</span> copied, <span class="mrel">÷1000</span> a unit conversion, <span class="mrel">↦</span> looked up, <span class="mrel derived">ƒ</span> calculated from it (and others). For this scenario's values: an input that only matters with other values (a zero share, a switched-off option) shows as not used.</p>`,
    `<div class="mfilter button-group" role="group" aria-label="Show">` +
      [
        ["all", `All ${m.rows.length}`],
        ["both", `Both ${counts.both}`],
        ["geeta", `Not used by ${C} ${counts.geeta}`],
        ["calc", `${C} only ${counts.calc}`],
        ["untraced", `Untraced ${counts.untraced}`],
      ]
        .filter(([k]) => k === "all" || counts[k])
        .map(([k, label], i) => `<button type="button" data-show="${k}" aria-pressed="${i === 0}"${i === 0 ? ' class="is-selected"' : ""}>${he(label)}</button>`)
        .join("") +
      `</div>`,
  );
  out.push(`<table class="mapping"><thead><tr><th>Neutral input</th><th>Value</th><th>GEETA</th><th>${he(C)}</th></tr></thead><tbody>`);
  let group = "";
  for (const r of m.rows) {
    const { group: g, label } = mappingGroup(r.path);
    if (g !== group) {
      group = g;
      out.push(`<tr class="mgroup"><th colspan="4">${he(g)}</th></tr>`);
    }
    const k = kind(r);
    const calcCell =
      k === "untraced"
        ? `<td class="muntraced">? ${he(m.calculatorTraced ? (r.note ?? "") : `${C} isn't run from the neutral scenario for this test`)}</td>`
        : htmlLandings(r.calculator, true, `not used by ${he(C)}`);
    const rowLabel = label.map((x) => (/^\d+$/.test(x) ? `row ${Number(x) + 1}` : x)).join(" › ");
    out.push(`<tr data-kind="${k}"><td>${he(rowLabel || "(value)")}</td><td class="mval">${he(formatInput(r.value))}</td>${htmlLandings(r.geeta, false, "—")}${calcCell}</tr>`);
  }
  out.push(`</tbody></table>`);
  if (m.adapterOnly.length)
    out.push(
      `<details class="mmore"><summary>${m.adapterOnly.length} ${he(C)} input(s) no neutral input reaches (the adapter's defaults and constants)</summary><table class="mapping"><tbody>${m.adapterOnly
        .map((l) => `<tr><td>${landingField(l.field, true)}</td><td class="mval">${he(formatInput(l.value))}</td></tr>`)
        .join("")}</tbody></table></details>`,
    );
  out.push(FILTER_SCRIPT);
  return out.join("");
};

const htmlTable = (t: InputTable) => {
  const flags = t.replace ? ` <span class="flags">(replaces the base scenario's table)</span>` : "";
  let s = `<h4>${he(t.title)}${flags}</h4>`;
  if (!t.rows.length) return s + `<p class="note">(no rows)</p>`;
  s += `<table><thead><tr><th></th>${t.headers.map((h) => `<th>${he(h)}</th>`).join("")}</tr></thead><tbody>`;
  for (const r of t.rows) s += `<tr><td class="rowhdr">${he(r.label)}</td>${r.values.map((v) => td(v, formatInput)).join("")}</tr>`;
  return s + "</tbody></table>";
};

const htmlExplanation = (r: ResultRow) => {
  if (!r.calcDiffers) return `<td class="difference"></td>`;
  if (!r.record) return `<td class="difference unexplained">Unexplained</td>`;
  const d = r.record;
  const ref = d.section ?? d.id;
  const review =
    r.review === "stale"
      ? `<span class="review" title="The inputs, GEETA or ${C} values (or the ${C} version) have changed since this was written">stale</span>`
      : r.review === "unreviewed"
        ? `<span class="review" title="Matched by scope, but never written against this scenario">unreviewed</span>`
        : "";
  return `<td class="difference"><span class="diff-ref" title="Section ${he(ref)} of ${he(calculator().findings)}">#${he(ref)}</span> <span class="diff-type">${he(d.type)}</span> ${he(d.note)}<span class="prov">${he(provenance(d))} · ${he(d.id)}${review}</span></td>`;
};

const htmlFindings = (r: ResultRow) =>
  `<td class="findings">${r.calcDiffers ? r.findings.map((f) => `<div>${he(f.text)}</div>`).join("") : ""}</td>`;

const htmlCheck = (r: ResultRow) => {
  if (!r.calcDiffers || !r.record) return `<td class="check"></td>`;
  if (!r.check) return `<td class="check none">No numeric check</td>`;
  const c = r.check;
  return `<td class="check ${c.ok ? "ok" : "suspect"}"><span class="verdict">${c.ok ? "✓" : "✗ Suspect"}</span>${he(c.kind)}: ${he(c.detail)}</td>`;
};

/** The mapping decisions (mapping.json) the adapter used for this scenario: what, the value, who decided and why. */
const decisionValue = (d: DecisionUse) => (d.gap ? "no decision" : d.to === null ? "no equivalent (left out)" : JSON.stringify(d.to));
const htmlDecisions = (decisions: DecisionUse[]) => {
  const rows = [...new Map(decisions.map((d) => [`${d.kind} ${d.key} ${d.value ?? ""}`, d])).values()];
  return (
    `<p class="note"><b>${he(C)} mapping decisions</b> (mapping.json): provider = decided by ${he(C)}'s provider; proposed = a draft not yet reviewed; no decision = a gap, the input was left out.</p>` +
    `<table class="decisions"><thead><tr><th>Decision</th><th>GEETA value</th><th>${he(C)}</th><th>By</th><th>Reason</th></tr></thead><tbody>` +
    rows
      .map(
        (d) =>
          `<tr class="${d.gap ? "gap" : (d.by ?? "provider")}"><td>${he(d.kind)} ${he(d.key)}</td><td>${he(d.value ?? "")}</td><td>${he(decisionValue(d))}</td><td>${he(d.gap ? "" : (d.by ?? "provider"))}</td><td>${he(d.reason ?? "")}</td></tr>`,
      )
      .join("") +
    `</tbody></table>`
  );
};

const htmlResults = (rows: ResultRow[], page: ScenarioPage) => {
  if (!rows.length) return `<p class="note">(no results)</p>`;
  // The explanation and check columns only appear when something on the page differs
  const showDifference = page.calc.status === "ok" && rows.some((r) => r.calcDiffers);
  const columns = ["NIR", "GEETA", C];
  let s = `<table class="results"><thead><tr><th>Result</th>${columns.map((c) => `<th class="col" title="${he(COLUMNS[c])}">${c}</th>`).join("")}${showDifference ? `<th title="${he(COLUMNS["Automatic findings"])}">Automatic findings</th><th title="${he(COLUMNS["LLM explanation"])}">LLM explanation</th><th title="${he(COLUMNS.Check)}">Check</th>` : ""}</tr></thead><tbody>`;
  for (const r of rows) {
    s += `<tr><td>${he(r.name)}</td>${td(r.nir, formatResult, r.nirDiffers ? ["differs"] : [])}${td(r.geeta, formatResult)}${page.calc.status === "ok" && !r.compared ? `<td class="empty" title="No module adapter mapped for this result yet">not mapped</td>` : td(page.calc.status === "ok" ? r.calc : { value: undefined }, formatResult, r.calcDiffers ? ["differs"] : [])}`;
    if (showDifference) s += htmlFindings(r) + htmlExplanation(r) + htmlCheck(r);
    s += "</tr>";
  }
  return s + "</tbody></table>";
};

const renderPage = (test: TestModel, page: ScenarioPage, prev?: ScenarioPage, next?: ScenarioPage) => {
  const h: string[] = [];
  h.push(`<div class="scennav">${prev ? `<a href="${he(prev.slug)}.html">&larr; ${he(prev.title)}</a><br />` : ""}${next ? `<a href="${he(next.slug)}.html">${he(next.title)} &rarr;</a>` : ""}</div>`);
  h.push(`<div class="crumbs"><a href="../index.html">index</a> &rsaquo; ${test.group.map(he).join(" &rsaquo; ")}</div>`);
  h.push(`<div class="meta"><div class="scentitle">${he(page.title)}</div>`);
  if (page.isBase) h.push(`<div class="tag base">Base / reference scenario &mdash; not published; shown for the complete input set.</div>`);
  if (page.description) h.push(`<div class="desc">${he(page.description)}</div>`);
  if (page.extends) h.push(`<span class="tag"><b>Extends:</b> ${he(page.extends)}</span>`);
  if (page.notes.length) h.push(`<div class="notes"><b>Notes:</b><ul>${page.notes.map((n) => `<li>${he(n)}</li>`).join("")}</ul></div>`);
  h.push(`<dl class="legend">${Object.entries(COLUMNS).map(([k, v]) => `<dt>${k}</dt><dd>${he(v)}</dd>`).join("")}</dl>`);
  h.push(`</div>`);

  // Three views of the same scenario: neutral (methodology terms), GEETA (the workbook test input) and what the
  // adapter gave the calculator
  const inputs: string[] = [
    `<h2>Inputs</h2><nav class="inputnav"><a href="#in-map">Mapping</a><a href="#in-neutral">Neutral</a><a href="#in-geeta">GEETA</a><a href="#in-calc">${he(C)}</a></nav>`,
  ];
  inputs.push(`<details class="inset" id="in-map" open><summary>Mapping: neutral &rarr; GEETA and ${he(C)}</summary>${htmlMapping(page.mapping)}</details>`);
  inputs.push(`<details class="inset" id="in-neutral" open><summary>Neutral</summary>`);
  inputs.push(`<p class="note">The scenario in the neutral format (docs/neutral-scenarios.md): activity data in the methodology's terms, converted from the workbook test input.</p>`);
  if (page.neutral?.value !== undefined) {
    const n = page.neutral.value as Record<string, unknown>;
    for (const part of ["scenario", "site", "inputs", "modules", "workbook"].filter((k) => n[k] !== undefined))
      if (part === "modules")
        // An enterprise: one part per module (src/neutral/enterprise.ts)
        for (const [section, m] of Object.entries<any>(n.modules as Record<string, unknown>)) inputs.push(`<h3>${he(section)}</h3>${jsonTree(m, 0, 1)}`);
      else inputs.push(`<h3>${he(part[0].toUpperCase() + part.slice(1))}</h3>${jsonTree(n[part], 0, part === "inputs" ? 1 : 0)}`);
  } else inputs.push(`<p class="note">${he(page.neutral?.error ? `Not converted: ${page.neutral.error}` : "No neutral format for this test.")}</p>`);
  inputs.push(`</details>`);

  inputs.push(`<details class="inset" id="in-geeta" open><summary>GEETA</summary>`);
  inputs.push(`<p class="note">The workbook test input, fully resolved (inheritance and table merges applied), by its InputFields labels.</p>`);
  for (const g of page.inputs) {
    inputs.push(`<h3>${he(g.title)}</h3>`);
    if (g.cells.length)
      inputs.push(`<table><thead><tr><th>Input</th><th>Value</th></tr></thead><tbody>${g.cells.map((c) => `<tr><td>${he(c.label)}</td>${td(c, formatInput)}</tr>`).join("")}</tbody></table>`);
    for (const t of g.tables) inputs.push(htmlTable(t));
  }
  if (!page.inputs.length) inputs.push(`<p class="note">(no inputs)</p>`);
  inputs.push(`</details>`);

  inputs.push(`<details class="inset" id="in-calc" open><summary>${he(C)}</summary>`);
  inputs.push(
    `<p class="note">What the adapter passed to ${he(C)} after mapping, in the order it ran them (each distinct input once; the extra runs made only for numeric checks are left out). <code>{ value: x }</code> wrappers are shown as x.</p>`,
  );
  if (page.calcInputs.length) for (const c of page.calcInputs) inputs.push(`<h3>${he(c.schema)}</h3>${jsonTree(c.input, 0, 1)}`);
  else inputs.push(`<p class="note">${he(page.calc.status === "ok" ? "(no inputs captured)" : (page.calc.message ?? `No ${C} run`))}</p>`);
  inputs.push(`</details>`);

  const results: string[] = ["<h2>Results</h2>"];
  if (page.calc.status !== "ok") results.push(`<p class="note"><b>${he(C)}:</b> ${he(page.calc.message)}</p>`);
  if (page.calc.notes.length) results.push(`<p class="note"><b>${he(C)} mapping notes:</b></p><ul class="calc-notes">${page.calc.notes.map((n) => `<li>${he(n)}</li>`).join("")}</ul>`);
  if (page.calc.decisions.length) results.push(htmlDecisions(page.calc.decisions));
  results.push(htmlResults(page.results, page));
  for (const fo of page.followOns) {
    results.push(`<h3>Follow-on &rarr; ${he(fo.test)}</h3><table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>`);
    results.push(fo.rows.map((r) => `<tr><td>${he(r.field)}</td><td>${he(r.value)}</td></tr>`).join("") + "</tbody></table>");
  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${he(test.id)} / ${he(page.title)}</title>
${headLinks("../")}
</head><body class="scenario">
${topBar("../")}
<div class="scenario-body">
<aside class="sidebar">${h.join("")}</aside>
<div class="panes">
<section class="pane inputs">${inputs.join("")}</section>
<div class="gutter" role="separator" aria-orientation="vertical" title="Drag to resize &bull; double-click to reset"></div>
<section class="pane results">${results.join("")}</section>
</div>
</div>
${GUTTER_SCRIPT}
</body></html>
`;
};

/** Index dashboard: totals, then every scenario where the calculator differs from GEETA, with the causes. */
const htmlDashboard = () => {
  const covered = models.filter((t) => t.pages.some((p) => p.calc.status === "ok"));
  const notCovered = models.filter((t) => !t.missing && t.pages.length && t.pages.every((p) => p.calc.status === "none"));
  const errors = models.flatMap((t) => t.pages.filter((p) => p.calc.status === "error").map((p) => ({ test: t, page: p })));
  const failing = covered
    .map((t) => ({
      test: t,
      pages: t.pages
        .filter((p) => p.calc.status === "ok")
        .map((p) => ({ page: p, differing: p.results.filter((r) => r.calcDiffers), total: p.results.filter((r) => r.geeta.value !== undefined).length }))
        .filter((x) => x.differing.length),
    }))
    .filter((x) => x.pages.length);

  const totals = covered.reduce(
    (acc, t) => {
      const c = calcCount(t.pages);
      return {
        match: acc.match + c.match,
        total: acc.total + c.total,
        unexplained: acc.unexplained + c.unexplained,
        verified: acc.verified + c.verified,
        suspect: acc.suspect + c.suspect,
        outdated: acc.outdated + c.outdated,
      };
    },
    { match: 0, total: 0, unexplained: 0, verified: 0, suspect: 0, outdated: 0 },
  );
  const scenarios = covered.reduce((n, t) => n + t.pages.filter((p) => p.calc.status === "ok").length, 0);
  const failingScenarios = failing.reduce((n, f) => n + f.pages.length, 0);

  const tile = (value: string, label: string, off = false) => `<div class="tile${off ? " off" : ""}"><b>${value}</b><span>${label}</span></div>`;
  const out: string[] = [`<section class="dashboard"><h2>Dashboard</h2><div class="tiles">`];
  out.push(tile(`${covered.length - failing.length}/${covered.length}`, "tests fully matching", failing.length > 0));
  out.push(tile(`${scenarios - failingScenarios}/${scenarios}`, "scenarios fully matching", failingScenarios > 0));
  out.push(tile(`${totals.match}/${totals.total}`, "results matching", totals.match < totals.total));
  out.push(tile(String(totals.unexplained), "unexplained differences", totals.unexplained > 0));
  out.push(tile(`${totals.verified}/${totals.total - totals.match - totals.unexplained}`, "LLM explanations verified by a numeric check"));
  out.push(tile(String(totals.suspect), "suspect explanations (check fails)", totals.suspect > 0));
  out.push(tile(String(totals.outdated), "explanations stale or unreviewed (evidence changed)", totals.outdated > 0));
  out.push(`</div>`);

  if (failing.length) {
    out.push(`<h3>Scenarios where ${he(C)} differs from GEETA</h3><table class="failing"><thead><tr><th>Test</th><th>Scenario</th><th>Differing</th><th>Why</th></tr></thead><tbody>`);
    for (const { test, pages } of failing)
      pages.forEach(({ page, differing, total }, i) => {
        // One chip per cause, marked ✓ (every check passes), ✗ (any check fails) or – (no check)
        const causes = new Map<string, { d: NonNullable<ResultRow["record"]>; checked: boolean; failed: boolean; outdated: boolean }>();
        let unexplained = 0;
        for (const r of differing) {
          if (!r.record) {
            unexplained++;
            continue;
          }
          const key = r.record.id;
          const c = causes.get(key) ?? { d: r.record, checked: false, failed: false, outdated: false };
          if (r.review && r.review !== "current") c.outdated = true;
          if (r.check) c.checked = true;
          if (r.check && !r.check.ok) c.failed = true;
          causes.set(key, c);
        }
        const chips = [
          ...[...causes.values()].map(({ d, checked, failed, outdated }) => {
            const mark = failed
              ? `<span class="mark">✗ suspect</span>`
              : checked
                ? `<span class="mark ok">✓</span>`
                : `<span class="mark none">–</span>`;
            const stale = outdated ? `<span class="mark stale">stale</span>` : "";
            return `<span class="chip${failed ? " suspect" : ""}" title="${he(d.note)} (${he(provenance(d))})"><b>#${he(d.section ?? d.id)}</b> ${he(d.type)}${mark}${stale}</span>`;
          }),
          ...(unexplained ? [`<span class="chip unexplained">${unexplained} unexplained</span>`] : []),
        ];
        const testCell = i === 0 ? `<td rowspan="${pages.length}" class="test"><a href="#${he(slug(test.id))}">${he(test.id)}</a></td>` : "";
        out.push(
          `<tr>${testCell}<td><a href="${he(test.id)}/${he(page.slug)}.html">${he(page.title)}</a></td><td class="num">${differing.length}/${total}</td><td>${chips.join(" ")}</td></tr>`,
        );
      });
    out.push(`</tbody></table><p class="note">Hover a cause for the LLM's explanation; the number is the section in ${he(calculator().findings)}. ✓ the numbers fit the explanation; ✗ they don't (diagnose again); – no numeric check.</p>`);
  } else out.push(`<p>${he(C)} matches GEETA in every scenario it covers.</p>`);

  if (errors.length)
    out.push(
      `<h3>${he(C)} adapter errors</h3><ul>${errors.map(({ test, page }) => `<li><a href="${he(test.id)}/${he(page.slug)}.html">${he(test.id)} / ${he(page.title)}</a>: ${he(page.calc.message)}</li>`).join("")}</ul>`,
    );
  if (notCovered.length)
    out.push(`<h3>Not covered by ${he(C)} yet</h3><p class="note">${notCovered.map((t) => `<a href="#${he(slug(t.id))}">${he(t.id)}</a>`).join(", ")}</p>`);
  out.push(`</section><h2 class="all">All scenarios</h2>`);
  return out.join("\n");
};

const writeHtml = (dir: string) => {
  // Wipe old output, except custom.css (the user's own overrides, loaded after styles.css)
  if (fs.existsSync(dir))
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }))
      if (entry.name !== "custom.css") fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  let pages = 0;
  const ix: string[] = [`<h1>VEERG test scenarios</h1>`];
  ix.push(`<div class="sub">Generated ${generated} from ${he(geetaLabel())}. Inputs are the fully resolved scenario data. Results: NIR, GEETA and ${he(C)}${version ? ` ${he(version)}` : ""}.${prefix ? ` <b>Filtered</b> to scenarios starting ${he(prefix)}.` : ""}</div>`);
  ix.push(htmlDashboard());
  for (const test of models) {
    const { match, total, unexplained } = calcCount(test.pages);
    const count = total
      ? `<span class="count${match < total ? " off" : ""}">${he(C)} matches GEETA: ${match}/${total}${unexplained ? `, ${unexplained} unexplained` : ""}</span>`
      : "";
    ix.push(`<h2 id="${he(slug(test.id))}">${he(test.id)} <small>(${he(test.group.join(" > "))})</small>${count}</h2>`);
    if (test.missing) {
      ix.push(`<p class="desc">TestInput file not found.</p>`);
      continue;
    }
    ix.push("<ul>");
    test.pages.forEach((page, i) => {
      fs.mkdirSync(path.join(dir, test.id), { recursive: true });
      fs.writeFileSync(path.join(dir, test.id, `${page.slug}.html`), renderPage(test, page, test.pages[i - 1], test.pages[i + 1]));
      pages++;
      const base = page.isBase ? `<span class="base">[base]</span>` : "";
      const desc = page.description ? `<span class="idesc">${he(page.description)}</span>` : "";
      ix.push(`<li>${base}<a href="${he(test.id)}/${he(page.slug)}.html">${he(page.title)}</a> ${desc}</li>`);
    });
    ix.push("</ul>");
  }
  fs.writeFileSync(
    path.join(dir, "index.html"),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VEERG test scenarios</title>
${headLinks("")}
</head><body class="index">
${topBar("")}
<main class="page"><div class="container-content">
${ix.join("\n")}
</div></main>
</body></html>
`,
  );
  fs.writeFileSync(path.join(dir, "styles.css"), STYLESHEET);
  // The design system as the pages link it (geeta/geeta.css with its fonts, icons and brand images), and this
  // tool's own assets; both relative, so the pages still open straight from disk
  if (!fs.existsSync(DESIGN_SYSTEM)) throw new Error(`Design system not installed (${DESIGN_SYSTEM}): run npm install`);
  fs.cpSync(DESIGN_SYSTEM, path.join(dir, "geeta"), { recursive: true });
  fs.cpSync(ASSETS, path.join(dir, "assets"), { recursive: true });
  const custom = path.join(dir, "custom.css");
  if (!fs.existsSync(custom))
    fs.writeFileSync(custom, "/* Your CSS overrides for the generated scenario pages. Loaded after styles.css and never regenerated. */\n");
  console.log(`Wrote ${path.join(dir, "index.html")} (${pages} pages, ${models.length} tests)`);
};

// --- Markdown ---------------------------------------------------------------------

const md = (v: unknown) => String(v ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
const mdValue = (v: Value, format: (v: unknown) => string) => (isEmpty(v.value) ? "—" : md(format(v.value)));
const anchor = (t: string) => t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");

const writeMarkdown = (file: string) => {
  const out: string[] = [];
  const w = (line = "") => out.push(line);
  const heading = (p: ScenarioPage) => (p.isBase ? `Base scenario (reference - not published): ${p.title}` : `Scenario: ${p.title}`);

  w("# VEERG test scenarios");
  w();
  w(`Generated ${generated} from ${geetaLabel()}. Inputs are the fully resolved scenario data (inheritance and table merges applied).`);
  if (prefix) w(`\n**Filtered** to scenarios whose name starts with \`${prefix}\`.`);
  w();
  w("Results columns:");
  w();
  for (const [k, v] of Object.entries(COLUMNS)) w(`- **${k}**: ${v}`);
  w();
  w("## Contents");
  w();
  for (const test of models) {
    w(`- [${test.id}](#${anchor(test.id)}) _(${test.group.join(" > ")})_`);
    for (const p of test.pages) w(`  - [${p.title}](#${anchor(heading(p))})`);
  }
  w();
  w("---");
  w();

  for (const test of models) {
    w(`## ${test.id}`);
    w();
    w(`**Group:** ${test.group.join(" > ")}`);
    const { match, total, unexplained } = calcCount(test.pages);
    if (total) w(`\n**${C} matches GEETA:** ${match}/${total}${unexplained ? `, ${unexplained} unexplained` : ""}`);
    w();
    if (test.missing) {
      w("_TestInput file not found._");
      w();
      continue;
    }
    for (const p of test.pages) {
      w(`### ${heading(p)}`);
      w();
      if (p.isBase) w("_Not part of the published set. Shown so a manual tester has the complete input set that the published scenario(s) build on._\n");
      if (p.description) w(`_${md(p.description)}_\n`);
      if (p.extends) w(`**Extends:** ${md(p.extends)}\n`);
      if (p.notes.length) {
        w("**Notes:**");
        w();
        for (const n of p.notes) w(`- ${md(n)}`);
        w();
      }
      for (const g of p.inputs) {
        w(`#### ${g.title}`);
        w();
        if (g.cells.length) {
          w("| Input | Value |");
          w("|---|---|");
          for (const c of g.cells) w(`| ${md(c.label)} | ${mdValue(c, formatInput)} |`);
          w();
        }
        for (const t of g.tables) {
          w(`**${md(t.title)}**${t.replace ? " _(replaces the base scenario's table)_" : ""}`);
          w();
          if (!t.rows.length) {
            w("_(no rows)_\n");
            continue;
          }
          w(`|  | ${t.headers.map(md).join(" | ")} |`);
          w(`|${["", ...t.headers].map(() => "---").join("|")}|`);
          for (const r of t.rows) w(`| **${md(r.label)}** | ${r.values.map((v) => mdValue(v, formatInput)).join(" | ")} |`);
          w();
        }
      }
      w("#### Results");
      w();
      if (p.calc.status !== "ok") w(`_${C}: ${md(p.calc.message)}_\n`);
      if (p.calc.notes.length) {
        w(`${C} mapping notes:`);
        w();
        for (const n of p.calc.notes) w(`- ${md(n)}`);
        w();
      }
      if (p.calc.decisions.length) {
        w(`${C} mapping decisions (mapping.json):`);
        w();
        w("| Decision | GEETA value | " + C + " | By | Reason |");
        w("|---|---|---|---|---|");
        for (const d of [...new Map(p.calc.decisions.map((d) => [`${d.kind} ${d.key} ${d.value ?? ""}`, d])).values()])
          w(`| ${md(`${d.kind} ${d.key}`)} | ${md(d.value ?? "")} | ${md(decisionValue(d))} | ${d.gap ? "" : (d.by ?? "provider")} | ${md(d.reason ?? "")} |`);
        w();
      }
      if (p.results.length) {
        const showDifference = p.calc.status === "ok" && p.results.some((r) => r.calcDiffers);
        w(`| Result | NIR | GEETA | ${C} |${showDifference ? " Automatic findings | LLM explanation | Check |" : ""}`);
        w(`|---|---:|---:|---:|${showDifference ? "---|---|---|" : ""}`);
        const mark = (s: string, differs: boolean) => (differs && s !== "—" ? `**${s}** ≠` : s);
        for (const r of p.results)
          w(
            `| ${md(r.name)} | ${mark(mdValue(r.nir, formatResult), r.nirDiffers)} | ${mdValue(r.geeta, formatResult)} | ${mark(p.calc.status === "ok" ? (r.compared ? mdValue(r.calc, formatResult) : "not mapped") : "—", r.calcDiffers)} |` +
              (showDifference ? ` ${md(findingsText(r))} | ${md(differenceText(r))} | ${md(checkText(r))} |` : ""),
          );
        w();
      }
      for (const fo of p.followOns) {
        w(`#### Follow-on -> ${fo.test}`);
        w();
        w("| Field | Value |");
        w("|---|---|");
        for (const r of fo.rows) w(`| ${md(r.field)} | ${md(r.value)} |`);
        w();
      }
    }
    w("---");
    w();
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join("\n"));
  console.log(`Wrote ${file}`);
};

if (htmlDir) writeHtml(path.resolve(htmlDir));
if (mdFile) writeMarkdown(path.resolve(mdFile));
// The findings document's list of excluded scenarios (comparison.config.json)
writeFindingsExclusions(Object.keys(calculator().adapters));
