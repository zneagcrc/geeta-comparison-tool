# geeta-comparison-tool

Compares an emissions calculator built from the VEERG methodology with **GEETA**, the VEERG calculation workbooks. It
runs the GEETA test scenarios through your calculator, shows every result side by side with GEETA's, and keeps a
record of why each difference exists, checked against the numbers.

- **Comparing is deterministic.** `geeta-compare test` and `geeta-compare docs` use no LLM.
- **Explaining is on request.** An LLM (Claude Code) explains differences from an evidence bundle; each explanation is
  stored with a numeric check and goes stale when its evidence changes.
- **The test set is a published GEETA release** ([zneagcrc/GEETA releases](https://github.com/zneagcrc/GEETA/releases)),
  downloaded and checked against the release manifest.

Your calculator can be TypeScript or JavaScript code, a command-line program, or an HTTP API: you connect it with an
adapter per test (see "Writing a calculator plug-in").

## Requirements

Node.js 22 or later. Python 3 for the optional diagnostic tools. Claude Code (or another coding agent) for
explanations.

## Setting up a workspace

A workspace is your own folder (usually your own git repository) holding your calculator plug-in, its explanations,
findings and docs. This package is installed into it.

```sh
mkdir my-calculator-vs-geeta && cd my-calculator-vs-geeta
npm init -y
npm install github:zneagcrc/geeta-comparison-tool#v<version>
npx geeta-compare init mycalc "My Calculator"     # writes geeta.config.json, calculator/, CLAUDE.md, ...
npm install                                       # the dependencies init added
npm run geeta:fetch                               # download the GEETA release pinned in geeta.config.json
npm run test:veerg                                # every test your plug-in has an adapter for
```

`init` writes:

| File | What it is |
|---|---|
| `geeta.config.json` | The GEETA release to compare with, and your calculator plug-in (`"calculators": { "mycalc": "calculator/index.ts" }`) |
| `calculator/index.ts` | Your plug-in: a `Calculator` with one adapter per GEETA test (see "Writing a calculator plug-in") |
| `findings.md` | Your findings document: numbered sections that explanations refer to |
| `comparison.config.json` | Scenarios to leave out of the comparison |
| `CLAUDE.md` | How Claude Code explains differences in this workspace |
| `package.json` scripts | `geeta:fetch`, `test:veerg`, `docs:scenarios`, `explain`, `typecheck` |
| `.gitignore` | Keeps downloaded releases, generated docs and your local overrides out of git |

Every command runs in the workspace it is started in (the folder with `geeta.config.json`, or below it). Set
`GEETA_WORKSPACE` to run one elsewhere.

Test names are the `Test.json` paths in the release: `Fuel`, `EntericMethane.Feedlot`, `ManureManagement.Pigs`, ...
Scenario names are as in the fixtures: `Default`, `NIRAlignment_4_5_ManureManagement_Pigs_03`, ... Quote anything with
a space.

## The GEETA test set

Every command reads one GEETA test set: test inputs and expected results (`Test/`), input labels (`InputFields/`), the
VEERG equation files (`Modules/**/*.xlf`), source data (`generated-sourcedata/`) and the generated test workbooks
(`TestExcel/`). By default it is the release pinned in `geeta.config.json`, downloaded into `geeta-releases/<release>/`.

```sh
npx geeta-compare fetch                    # the pinned release, every file checked against its manifest
npx geeta-compare fetch VEERG_0.0.0.4      # another release
npx geeta-compare fetch --force            # download it again
```

Moving to a new release: change `release` in `geeta.config.json`, fetch it, run the comparison, and explain anything
new or stale. Evidence fingerprints cover each scenario's inputs, GEETA's results and yours, so only explanations whose
evidence changed go stale. `fetch` refuses a release whose manifest `toolingContract` this version can't read: update
this package.

To compare with something other than the pinned release (another downloaded release, or a GEETA working copy), override
it. First match wins:

| Override | Example |
|---|---|
| `VEERG_TEST_DIR` (a `Test` folder) | `VEERG_TEST_DIR=../GEETA-work/Test npm run test:veerg` |
| `GEETA_DIR` (a folder holding `Test/`) | `GEETA_DIR=../GEETA-work npm run test:veerg` |
| `geeta.local.json` (gitignored; stays until you delete it) | `{ "dir": "../GEETA-work" }`, or `{ "release": "VEERG_0.0.0.4" }` |

Every run says which test set it used (`My Calculator 1.2.0 compared with GEETA VEERG_0.0.0.3`), and so do the scenario
docs and explanation bundles.

The VEERG methodology documents aren't in the GEETA release. For explanations that cite them, point
`VEERG_DOCUMENTS_DIR` or `geeta.local.json` `"veergDocuments"` at your copy. Without them, explanations cite the `.xlf`
equations and workbook cells instead.

## Comparing

```sh
npm run test:veerg                                             # every test that has an adapter
npx geeta-compare test Fuel                                    # one test
npx geeta-compare test Fuel Electricity WasteSolid             # several tests
npx geeta-compare test EntericMethane.Feedlot                  # a nested test
npx geeta-compare test "ManureManagement.Pigs:NIRAlignment_4_5_ManureManagement_Pigs_03"   # one scenario
```

Each result is `PASS` (within 1e-6 relative), `FAIL #n` (explained: section n of your findings document) or `FAIL ?`
(unexplained), with the explanation's numeric check (`✓`, `✗ SUSPECT`, `-`), `stale` / `unreviewed` when the evidence
changed since it was explained, and automatic findings from the numbers alone (×100, ×1000, a GWP, values not
calculated, a ratio shared across a scenario, ...).

## Excluding scenarios

`comparison.config.json` lists scenarios to leave out (templates, scenarios using features your calculator doesn't
claim to cover). An excluded scenario isn't run, explained or documented, and isn't counted; the docs list the
exclusions in your findings document.

```jsonc
{ "exclude": [
  { "test": "ManureManagement.Pigs", "scenario": "Default", "reason": "Uses stage 2 routes we don't support" },
  { "test": "Fertiliser", "scenario": "*Empty*", "reason": "Template" }
] }
```

`test` and `scenario` are exact names with `*` wildcards; no `scenario` excludes the whole test; `calculators` (a list
of ids) limits a rule to some calculators; `reason` is required. A rule that matches nothing is reported as a warning.

## Scenario docs (HTML and Markdown)

```sh
npm run docs:scenarios                                         # both, to the plug-in's docsDir (html/ and TestScenarios.md)
npx geeta-compare docs --html out/html                         # HTML only, to a folder
npx geeta-compare docs --md out/TestScenarios.md               # Markdown only, to a file
npx geeta-compare docs --test 4_5_ManureManagement_Pigs        # one test (by TestID, as in Test.json)
npx geeta-compare docs --prefix NIRAlignment                   # published scenarios only (+ the base scenarios they extend)
npx geeta-compare docs --modules-only                          # skip the enterprises
npx geeta-compare docs --enterprises-only
```

Open `<docsDir>/html/index.html` for the dashboard: totals, every scenario where your calculator differs and why, then
every scenario's page with its inputs (neutral, GEETA, and what your adapter gave your calculator) and results (NIR,
GEETA, yours, findings, explanation, check). The pages open straight from disk. Your own CSS goes in
`<docsDir>/html/custom.css`, which is never overwritten.

Each module scenario page starts with a **mapping** table: every neutral input, the GEETA workbook field it is written
to and your calculator's input(s) it reaches (`=` copied, `÷1000` a unit conversion, `↦` looked up, `ƒ` calculated
from it). It is traced, not declared: each neutral input is changed in turn and the workbook fixture and your
calculator's inputs are regenerated, so it needs your plug-in's `captureInputs` (and is faster with
`captureInputsOnly`). Traces are cached in `<docsDir>/.mapping-cache.json`.

## Explanations (LLM on request only)

```sh
npm run explain -- status                                      # what is unexplained, suspect, stale or unreviewed
npm run explain -- status ManureManagement.Pigs                # for one test
npm run explain -- bundle ManureManagement.Pigs                # evidence bundle for a whole test
npm run explain -- bundle "ManureManagement.Pigs:NIRAlignment_4_5_ManureManagement_Pigs_03"   # for one scenario
npm run explain -- history ManureManagement.Pigs               # every stored explanation, incl. superseded
npm run explain -- add draft.json                              # record an explanation (refused if its check fails)
npm run explain -- add draft.json --force                      # record it even though the check fails
```

Then ask Claude Code, in the workspace:

> explain the differences in explanations/mycalc/requests/ManureManagement.Pigs.md

The workspace's `CLAUDE.md` gives it the workflow: start from stored explanations, diagnose what isn't explained
([docs/diagnosing.md](docs/diagnosing.md)), give each explanation a numeric check, record it with `explain add`, and
write it up in your findings document. Explanations are append-only JSON in `explanations/<id>/<Test>.json`; a draft
for `add` looks like this (`add` fills in the id, date and evidence fingerprints):

```json
{
  "test": "WasteSolid",
  "section": "7b",
  "type": "Constant convention",
  "scope": { "result": "^VEERG_10_1_8__" },
  "note": "My Calculator converts carbon to CH4 with 16/12; the workbook uses 1.33 (ratio 1.0025).",
  "sources": ["VEERG Chapter 10, 10.1.8", "calculator/constants.ts"],
  "check": { "kind": "ratio", "factors": { "(16/12) / 1.33": 1.00250626566416 } },
  "model": "claude-opus-5-5"
}
```

Checks: `reproduces` (a `PROBE:<result>` value from your adapter, recomputed with the cause corrected, equals GEETA),
`ratio` (your result / GEETA equals the factor the cause implies) or `bound` (direction and rough size only).

## Writing a calculator plug-in

`calculator/index.ts` default-exports a `Calculator` (`geeta-comparison-tool/src/calculators/types`):

| Field | |
|---|---|
| `id`, `name` | `id` names its folders and selects it; `name` is shown in reports ("<name> defect", "<name> coverage gap") |
| `version()` | Your calculator's version; part of every evidence fingerprint, so a new version marks its explanations stale |
| `adapters` | One per test, by `Test.json` path (`"Fuel"`, `"EntericMethane.Feedlot"`) |
| `adapterDir` | Where the adapter sources are (relative to the workspace), for explanation bundles: `<adapterDir>/<function name>.ts` |
| `findings`, `docsDir` | Your findings document and scenario docs folder (relative to the workspace) |
| `captureInputs`, `captureInputsOnly` | Optional: the inputs your calculator was given, for the docs and the mapping trace |
| `sourceFiles` | Optional: calculator files an adapter uses, listed in explanation bundles |
| `neutralResults` | Optional: results from a neutral scenario, for `geeta-compare neutral run` |

An adapter takes the resolved GEETA test input for one scenario and returns your results keyed by the GEETA result
names (`VEERG_8_1_1__1_..._Result_Method1`), plus `PROBE:<result>` values for numeric checks. An adapter that maps only
some results sets `covers` (`PartialAdapter`). Adapters are synchronous; call an out-of-process calculator (a CLI, a
Python script, an HTTP API through a small client script) with `child_process.execFileSync`.

Start from the neutral scenario rather than workbook cells: `fromVeerg(spec, input)` (`src/neutral/engine`) with the
specs in `src/neutral/modules/` gives the activity data in the methodology's terms (format:
[docs/neutral-scenarios.md](docs/neutral-scenarios.md)).

```ts
import type { Adapter } from "geeta-comparison-tool/src/calculators/types";
import { fromVeerg } from "geeta-comparison-tool/src/neutral/engine";
import { FUEL } from "geeta-comparison-tool/src/neutral/modules/batch1";

export const fuel: Adapter = (input) => {
  const scenario = fromVeerg(FUEL, input);     // activity data in the methodology's terms
  const result = myCalculator.fuel(scenario);  // your calculator
  return { VEERG_8_1_1__1_CarbonDioxideEmissionsFromTransportFuel_Result_Method1: result.co2Tonnes };
};
```

Run `npm run typecheck` and `npm run test:veerg`, then explain the differences.

## Neutral scenarios

Every module and enterprise test has a neutral format: the activity data a user records, named as in the
methodology (catalogue: `catalogue/veerg-inputs.md`). Format: [docs/neutral-scenarios.md](docs/neutral-scenarios.md).

```sh
npx geeta-compare neutral check                                # round-trip every fixture through the neutral format
npx geeta-compare neutral check ManureManagement.Pigs          # one module
npx geeta-compare neutral export                               # write scenarios/<module>/*.json from the fixtures
npx geeta-compare neutral to-veerg scenarios/8-fuel/Fuel.json > fixture.json   # neutral -> workbook fixture
npx geeta-compare neutral run scenarios/8-fuel/Fuel.json       # neutral -> your calculator's results
npx geeta-compare baseline compare                             # adapters still give the saved baseline exactly
npx geeta-compare baseline save                                # re-save it (only after an intended change)
```

## Diagnostic tools (Python)

For diagnosing a difference by hand (workflow: [docs/diagnosing.md](docs/diagnosing.md)). `R` is the downloaded
release, e.g. `geeta-releases/VEERG_0.0.0.3`; `T` is this package, e.g. `node_modules/geeta-comparison-tool`.

```sh
python -I $T/tools/xlsxf.py $R/TestExcel/<workbook>.xlsx "Methane" --sheet "4.6.1.1-2 Methane"   # formulas and cached values
python -I $T/tools/xlsxf.py $R/Modules/<workbook>.xlsx --names                                  # defined names
python -I $T/tools/cellformula.py $R/Modules/<workbook>.xlsx "Input - Sheep" E170 E171          # one cell's formula chain
python -I $T/tools/deadnames.py $R/TestExcel/*.xlsx                                             # result names pointing at empty cells
python -I $T/tools/xlf-catalogue.py $R/Modules catalogue                                        # input catalogue + consistency checks
python -I $T/tools/docx2txt.py <outdir> "<VEERG document>.docx"                                 # methodology text
```

## Licence

[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/): see
[LICENSE](LICENSE). The bundled geeta design system (`vendor/geeta-design-system`) includes the JUST Sans font files.
