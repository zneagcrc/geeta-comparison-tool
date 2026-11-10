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

Node.js 22 or later. For the LLM steps (writing adapters, explaining differences): an Anthropic API key, or a Claude
Code sign-in; `init` installs Claude Code in the workspace. Python 3 for the optional diagnostic tools.

## Quick start

From an empty folder to explained differences. Each step links to its section below.

1. **Install and set up the workspace** ("Setting up a workspace"):
   ```sh
   npm init -y
   npm install github:zneagcrc/geeta-comparison-tool#v<version>
   npx geeta-compare init
   npm install
   npm run geeta:fetch                # the GEETA test set
   ```
2. **Define your calculator** in `geeta.config.json` ("Adding a calculator"):
   ```json
   "calculators": [ { "name": "Acme", "release": "npm:@acme/emissions", "version": "latest" } ]
   ```
3. **Install it:** `npx geeta-compare install Acme`. Check `geeta.lock.json` shows the version you meant (npm's
   `latest` is the newest *stable* release; use a tag such as `beta`, or an exact version, otherwise).
4. **To use an LLM, add its key** ("Using an LLM"): copy `.env.example` to `.env`, set `ANTHROPIC_API_KEY=...`, and run
   `npx geeta-compare llm` (it checks the key and the model, using no tokens).
5. **See which tests need an adapter:** `npx geeta-compare test` lists them. Start with a small one, e.g. `Fuel`.
6. **Write the adapter**, one test at a time, either way ("Developing adapters"):
   - **With the LLM:** `npx geeta-compare llm adapter Fuel` (add `hint:"..."` for anything you know, e.g.
     `hint:"Acme has no town gas"`). Claude Code writes the adapter in
     `calculators/acme/`, proposes its mapping decisions in `calculators/acme/mapping.json` (as `"proposed"`), runs
     the test and reports what it mapped and left out. The run is billed to your key.
   - **Yourself:** follow "Developing adapters", step by step, and
     [docs/mapping-decisions.md](docs/mapping-decisions.md).
7. **Review the mapping:** `npx geeta-compare mapping` lists open decisions and the LLM's proposals. Keep each
   proposal (`"by": "provider"`), change it, or remove it; edit the adapter code as you like. Then
   `npm run docs:scenarios` and check each scenario's mapping table ("Not used by" inputs should all be deliberate).
   A wrong mapping looks exactly like a calculator defect, so review before explaining.
8. **Compare:** `npm run test:veerg` (deterministic, no LLM).
9. **Explain the differences:** `npx geeta-compare llm explain Fuel` ("Explanations"), then review the findings
   document (`findings/acme.md`).

Repeat 5 to 9 for the next test. `npx geeta-compare mapping --check` and `npm run test:veerg` in CI keep it honest.

## Setting up a workspace

A workspace is your own folder (usually your own git repository). This package is installed into it first; the
calculators you compare are defined and installed later, each with its plug-in, explanations, findings and docs.

```sh
mkdir geeta-comparison && cd geeta-comparison
npm init -y
npm install github:zneagcrc/geeta-comparison-tool#v<version>
npx geeta-compare init                            # the workspace, no calculator yet
npm install                                       # the dependencies init added
npm run geeta:fetch                               # download the GEETA release pinned in geeta.config.json
```

`init` writes:

| File | What it is |
|---|---|
| `geeta.config.json` | The GEETA release to compare with, and the calculators (none yet) |
| `comparison.config.json` | Scenarios to leave out of the comparison |
| `CLAUDE.md` | How Claude Code explains differences in this workspace |
| `package.json` scripts | `geeta:fetch`, `geeta:install`, `test:veerg`, `docs:scenarios`, `explain`, `llm`, `typecheck` (and Claude Code as a dev dependency) |
| `.env.example` | The secrets the workspace can use (the LLM key, API calculators' keys): copy to `.env` |
| `.gitignore` | Keeps downloaded releases, generated docs and your local overrides out of git |

## Adding a calculator

Define the calculator in `geeta.config.json`: an id (it names its folders), a name, where its releases come from and
which version to use.

```json
{
  "repo": "zneagcrc/GEETA",
  "release": "VEERG_0.0.0.3",
  "calculators": [
    { "name": "Acme", "release": "npm:@acme/emissions", "version": "latest" }
  ]
}
```

`"calculators"` is a list: each calculator is known by its `name`. Its id, which names its folders
(`calculators/<id>/`, `findings/<id>.md`, `explanations/<id>/`, `docs/<id>/`), is made from the name: lower case, with
anything but letters and digits as a dash ("Acme" → `acme`, "Method workbench" → `method-workbench`). Give an entry an
`"id"` to choose it yourself. Commands take the name or the id (`install Acme`, `--calculator "Method workbench"`).

| `release` | What `install` does | `version` |
|---|---|---|
| `npm:<package>` | `npm install` the package at that version | an exact version, a dist-tag (`latest`, `beta`, ...) or a range |
| `github:<owner>/<repo>` | `npm install` the repo at a release tag | a tag, or `latest` (the newest GitHub release) |
| a folder, e.g. `../my-calculator` | links the local package (for a calculator you are developing) | its `package.json` version |
| `http(s)://...` | nothing to install: adapters call the API (see "Calculators released as an API") | the API's own, from its OpenAPI document; else as written |
| (none) | nothing: the plug-in brings its own calculator | as written |

Then install it:

```sh
npx geeta-compare install Acme       # by name or id; with neither, every calculator in geeta.config.json
```

`install` resolves the version (what `latest` means today), installs that release, and records the exact version in
`geeta.lock.json` (commit it: it says what your results were compared against). The first time, it also creates the
plug-in `calculators/acme/index.ts`, its `mapping.json`, and the findings document `findings/acme.md`. Then write
the plug-in's adapters, one test at a time: have the LLM write a first version (`npx geeta-compare llm adapter <Test>`,
"Using an LLM") or write them yourself ("Developing adapters"), then `npm run typecheck` and `npm run test:veerg`.

To upgrade, run `install` again: a `latest` calculator moves to the newest release (`upgraded from 1.2.3`), or change
`version` first. The recorded version is part of every explanation's evidence, so explanations written against the
old version show as stale until they are reviewed. With several calculators, choose one per command with
`--calculator <id>`, or set `"calculator": "<id>"` in `geeta.config.json` as the default.

npm's `latest` tag is the newest stable release; a calculator that publishes pre-releases may tag them (e.g. `beta`).

### Calculators released as an API

A calculator that runs as an HTTP API (on a server, or locally) needs nothing installed. Give its base URL as the
release, with `{version}` where the API's version goes, and the name of the environment variable holding its key:

```json
"calculators": [
  {
    "name": "Acme API",
    "release": "http://localhost:5180/api/v1/{version}",
    "version": "draft",
    "apiKeyEnv": "ACME_API_KEY"
  }
]
```

Put the key in the workspace's `.env` (`ACME_API_KEY=...`; `init` gitignores it), never in `geeta.config.json`. It is
sent as `Authorization: Bearer <key>`. `install` checks that the API answers and accepts the key, and records the
API's own version (from `<url>/openapi.json`, `info.version`) and where its OpenAPI document is.

The plug-in `install` creates for an API uses `apiClient` (`geeta-comparison-tool/src/http`): `api.post("<endpoint>",
body)` sends JSON to `<url>/<endpoint>` and returns the parsed response, throwing on an error status with the API's
message. Identical requests in one run are sent once. Set `captureInputs: api.captureInputs` in the plug-in and the
scenario docs show every request an adapter sent. For any other HTTP call in an adapter, `requestJsonSync` does one
request synchronously.

Every command runs in the workspace it is started in (the folder with `geeta.config.json`, or below it). Set
`GEETA_WORKSPACE` to run one elsewhere.

Test names are the `Test.json` paths in the release: `Fuel`, `EntericMethane.Feedlot`, `ManureManagement.Pigs`, ...
Scenario names are as in the fixtures: `Default`, `NIRAlignment_4_5_ManureManagement_Pigs_03`, ... Quote anything with
a space.

## Using an LLM

Two steps can use an LLM: writing a first version of an adapter, and explaining differences. Nothing else does:
`test`, `docs`, `explain status`/`bundle`/`add` and `mapping` never call one. Set the LLM in `geeta.config.json` and
its key in the workspace's `.env` (`init` writes both, with `.env.example` to copy):

```json
"llm": {
  "provider": "anthropic",
  "model": "claude-opus-5-5",
  "apiKeyEnv": "ANTHROPIC_API_KEY",
  "auth": "key"
}
```

```sh
# .env (gitignored; never commit it)
ANTHROPIC_API_KEY=sk-ant-...
```

| Setting | |
|---|---|
| `provider` | `anthropic` (the only one supported so far) |
| `model` | The model the agent runs on, e.g. `claude-opus-5-5`, `claude-sonnet-5-5` |
| `apiKeyEnv` | The environment variable (or `.env` entry) holding the key; the key itself never goes in `geeta.config.json` |
| `auth` | `key` (default): only that key is used, and a run stops if it isn't set. `sign-in`: Claude Code's own sign-in (e.g. a Claude subscription) instead, and the key is ignored |

```sh
npx geeta-compare llm                          # the settings, and a check that the key works and the model exists (no tokens used)
npx geeta-compare llm adapter Fuel             # Claude Code writes the adapter for a test (mapping decisions as "proposed")
npx geeta-compare llm adapter Fuel hint:"Acme has no town gas" hint:"use the current car type, not pre-2004"
npx geeta-compare llm explain ManureManagement.Pigs   # builds the evidence bundle, then Claude Code explains the differences
```

The agent is Claude Code, which `init` adds to the workspace as a dev dependency (`@anthropic-ai/claude-code`). It
runs in the workspace with your model and key, follows the workspace's `CLAUDE.md`, and may only read and edit files
and run `npx geeta-compare` and `npm run` commands. Each run is billed to the key (or the sign-in) like any other use.

**Hints** (`hint:"..."` or `--hint "..."`, any number, for `llm adapter` and `llm explain`) tell the agent what you know
about your calculator. A mapping decision that follows directly from a hint is recorded in `mapping.json` as yours
(`"by": "provider"`, with the hint as its reason), so it needs no review and later runs keep it without the hint;
everything else the agent works out stays `"proposed"`. For `llm explain`, hints are leads it cites, and every
explanation still needs its numeric check.

While it runs, it prints what it is doing (`→ Read calculators/acme/index.ts`, `→ Run: npx geeta-compare test Fuel`,
what it says between steps, and `… still working (2m 30s)` when it is quiet), then its report, the time taken, the
cost and the number of turns. A first adapter typically takes several minutes.

With `auth: "key"`, Claude Code gets an empty settings folder of its own and the key through its `apiKeyHelper`
setting, so it can't fall back to a sign-in it finds on the machine; if it reports any other credential, the run is
stopped before its first request, and a refused key stops it at once. You can also open Claude Code in the workspace
yourself and ask it the same things.

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

Every run says which test set it used (`Acme 1.2.0 compared with GEETA VEERG_0.0.0.3`), and so do the scenario
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

`test` and `scenario` are exact names with `*` wildcards; no `scenario` excludes the whole test; `calculators` (names or
ids) limits a rule to some calculators; `reason` is required. A rule that matches nothing is reported as a warning.

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

Then run `npx geeta-compare llm explain ManureManagement.Pigs` ("Using an LLM"), which builds the bundle and has
Claude Code explain it, or ask Claude Code in the workspace yourself:

> explain the differences in explanations/acme/requests/ManureManagement.Pigs.md

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
  "note": "Acme converts carbon to CH4 with 16/12; the workbook uses 1.33 (ratio 1.0025).",
  "sources": ["VEERG Chapter 10, 10.1.8", "calculator/constants.ts"],
  "check": { "kind": "ratio", "factors": { "(16/12) / 1.33": 1.00250626566416 } },
  "model": "claude-opus-5-5"
}
```

Checks: `reproduces` (a `PROBE:<result>` value from your adapter, recomputed with the cause corrected, equals GEETA),
`ratio` (your result / GEETA equals the factor the cause implies) or `bound` (direction and rough size only).

## Writing a calculator plug-in

The plug-in (`calculators/<id>/index.ts`, created by `install`) default-exports a `CalculatorPlugin`
(`geeta-comparison-tool/src/calculators/types`). Only `adapters` is required: the id, name and version come from
`geeta.config.json` and `geeta.lock.json`, and the paths have defaults. Any of them can be set to override that.

| Field | |
|---|---|
| `adapters` | One per test, by `Test.json` path (`"Fuel"`, `"EntericMethane.Feedlot"`) |
| `name` | Default: the config's `name`. Shown in reports ("<name> defect", "<name> coverage gap") |
| `version()` | Default: the version `install` recorded. Part of every evidence fingerprint. Give an API calculator one that asks the API |
| `adapterDir` | Default: the plug-in's folder. Where adapter sources are, for explanation bundles: `<adapterDir>/<function name>.ts` |
| `findings`, `docsDir` | Defaults: `findings/<id>.md` and `docs/<id>` (relative to the workspace) |
| `captureInputs`, `captureInputsOnly` | Optional: the inputs your calculator was given, for the docs and the mapping trace |
| `sourceFiles` | Optional: calculator files an adapter uses, listed in explanation bundles |
| `neutralResults` | Optional: results from a neutral scenario, for `geeta-compare neutral run` |

An adapter connects one GEETA test to your calculator. It takes the resolved input of one scenario of that test and
returns your calculator's results keyed by the GEETA result names (e.g.
`VEERG_5_3_1_1__1_LimeApplicationCO2Emissions_Result_Method1`). The adapters are registered in the plug-in by test:
`adapters: { Fuel: fuel, "Enterprises.CroppingGrains": croppingGrains }`.

## Developing adapters

There are two ways to develop adapters, and they mix freely:

| | Write them yourself | Let an LLM write a first version, then customise |
|---|---|---|
| Adapter code (which function or endpoint, reshaping, result names) | You write it, following the steps below | Claude Code writes it ("With Claude Code", below); from then on it is your code to edit |
| Mapping decisions (code lookups, defaults, assumptions) | You write them in `mapping.json` as `"by": "provider"` | Claude Code adds them as `"by": "proposed"`; you keep, change or reject each, and kept ones become `"provider"` |
| Determinism | Plain code and data: no LLM runs in `test`, `docs` or `explain` | The same: the LLM writes files once, and never changes a `provider` decision |
| Knowing it's complete | `npx geeta-compare mapping` lists open decisions; `--check` fails while any remain | The same, and `--check` also fails while proposals are unreviewed |

You can write the adapters for the modules you know and ask for the rest, or ask Claude Code again after a calculator
or GEETA upgrade: it proposes decisions for the new gaps only and leaves yours alone.

### Mapping decisions as data (`mapping.json`)

The choices a provider owns (which calculator code a GEETA option becomes, what a calculator input defaults to,
how an ambiguous definition is read) live in `calculators/<id>/mapping.json`, which `install` creates. Adapters read
them instead of hard-coding them:

```json
{
  "lookups": {
    "fuel type q": {
      "geeta": "Table_Input_Fuel.FuelType",
      "values": {
        "Petrol":   { "to": "petrol", "by": "provider" },
        "Fuel oil": { "to": "diesel", "by": "proposed", "reason": "Acme treats fuel oil as diesel (Acme docs 4.2)" },
        "Town gas in GJ": { "to": null, "by": "provider", "reason": "not supported" }
      }
    }
  },
  "defaults": {
    "purchases[].fractionConsumed": { "value": 1, "by": "provider", "reason": "Acme assumes all fuel is used in the year" }
  },
  "assumptions": {
    "lime FracLime": { "reading": "limestone share of the product; the rest is dolomite", "by": "proposed", "reason": "the schema doesn't say" }
  }
}
```

```ts
import { mapping } from "geeta-comparison-tool/src/mapping";
const m = mapping("acme");
const type = m.lookup("fuel type q", row["fuel type q"]);   // undefined: no equivalent, or no decision (a gap)
const fraction = m.default("purchases[].fractionConsumed");
```

- `"to": null` is a decision too: no equivalent, so the input is left out with a note giving your reason.
- A value or field with **no entry** is a gap: the input is left out with a note, never guessed.
- `"geeta"` ties a lookup table to its GEETA field (`Table.Column`, or an `X_Cell_...` cell), so every option of that
  field is checked, not only the ones the test scenarios use. For options that depend on another field (the fuel types
  of one fuel use), add the parent value: `"Table_Input_Fuel.FuelType[Generators]"`.
- Decisions with a reason, proposals and defaults print a note in `test`, and every scenario page in the docs lists
  the decisions its adapter used, with who decided each one and why.

```sh
npx geeta-compare mapping            # gaps, GEETA options with no decision, proposals to review, unused decisions
npx geeta-compare mapping --check    # exits 1 while there are gaps, undecided options or proposals (for CI)
```

Unit conversions, reshaping and derived values stay in the adapter's code, described in its mapping record
([docs/mapping-decisions.md](docs/mapping-decisions.md), section 5): they follow from definitions, not choices.

### Step by step

Develop one test at a time. Each step below says where to look.

1. **See what the test holds.** Run `npm run docs:scenarios` and open the test's pages: for each scenario they show the
   GEETA inputs (by their workbook labels), the same inputs in the neutral format, and GEETA's expected results.
   `npx geeta-compare neutral export <Test>` writes the neutral scenarios as JSON files (`scenarios/<module>/`), and the
   raw files are in the release (`geeta-releases/<release>/Test/`: `TestInput_*.json`, `TestResults_*.json` for the
   result names; `npx geeta-compare names <Test>` lists them without their values). `npx geeta-compare test` lists the
   tests that have no adapter yet. If you want to map without knowing the expected results (as the LLM does), use the
   neutral export, the release's `InputFields/` and `names`, and leave the scenario docs until the adapter is written.
2. **Convert the input to the neutral format.** The adapter receives the workbook's test input, fully resolved (a
   scenario that extends another is already merged with it): input cells (`X_Cell_*`) and tables (`InputTables`). Don't
   read those directly: `moduleFor("<Test>")!.fromVeerg(input)` gives the same scenario as activity data named in the
   methodology's terms (`site`, `inputs`, or for an enterprise one part per module), the format in
   [docs/neutral-scenarios.md](docs/neutral-scenarios.md). Every test has one, enterprises included.
3. **Map the neutral scenario onto your calculator's inputs** and call it: your package, a command-line program with
   `child_process.execFileSync`, or an API with `apiClient`. Each field is a decision (copy it, convert its unit, look
   up its code, derive it, leave it out with a note), made from what both sides define it to mean:
   [docs/mapping-decisions.md](docs/mapping-decisions.md) sets out the kinds, the evidence each needs, where translating
   stops and calculating starts, and how to record each decision in the adapter.
4. **Return the results under GEETA's result names**, in GEETA's units (the expected results show them). Return only
   what your calculator works out: a name you leave out shows as "(not calculated)". If the adapter covers only some
   of a test's results (an enterprise endpoint that only does fertiliser, say), give it `covers` (a list of patterns
   for the result names it handles; `PartialAdapter`) and the others aren't compared.
5. **Say what you couldn't map.** When an input has no place in your calculator (a fuel type, a manure system or an
   option it doesn't support), leave it out with a note: a `"to": null` decision in `mapping.json` prints one for you,
   and anything else gets a `console.warn("...")`. Notes appear under the scenario in `test` and as mapping notes in
   the scenario docs, and they are what a "coverage gap" explanation cites. Never drop an input silently. Then
   `npx geeta-compare mapping` shows what is still undecided.
6. **Run it and check the mapping.** `npx geeta-compare test <Test>` compares every scenario; an adapter that throws
   shows `ERROR` with its message for that scenario. Then regenerate the docs: with `captureInputs` in the plug-in, each
   scenario's mapping table traces every neutral input to your calculator's inputs, and the "Not used by <name>" filter
   lists the inputs your adapter didn't pass on. Each of those should be deliberate, with a note.
7. **Lock it in.** `npx geeta-compare baseline save` records every adapter's output; after any later change to an
   adapter or a calculator upgrade, `npx geeta-compare baseline compare` shows exactly what moved.
8. **Explain the differences** that remain ("Explanations").

Rules that keep the comparison honest:

- **Map inputs only.** An adapter never reads GEETA's expected results, and nothing in it is tuned until the numbers
  match. A difference is explained (and checked), not hidden: that is what makes a match mean something.
- **Translate, don't calculate.** Unit conversions by fixed factors, code lookups and definitional arithmetic (rate ×
  area) are the adapter's; anything that needs an emission factor, a GWP or a methodology equation is the
  calculator's ([docs/mapping-decisions.md](docs/mapping-decisions.md), section 3).
- **Record the decisions**: choices (lookups, defaults, assumptions) in `mapping.json`, and the rest in a mapping
  record at the top of each adapter (input, calculator input, kind, basis); check both against the docs' mapping trace.
- **Keep adapters deterministic and synchronous**: the same input gives the same request and the same results.
- Shared code (state codes, class names, a site helper) goes in modules beside the adapters, e.g.
  `calculators/<id>/common.ts`; explanation bundles include the local modules an adapter imports.
- `PROBE:<result>` values (the same result recomputed with a suspected cause corrected) are added while explaining a
  difference, not before.

```ts
import type { Adapter } from "geeta-comparison-tool/src/calculators/types";
import { moduleFor } from "geeta-comparison-tool/src/neutral/registry";
import { mapping } from "geeta-comparison-tool/src/mapping";
import * as calc from "@acme/emissions";                   // your calculator

const toNeutral = moduleFor("Fuel")!.fromVeerg;
const m = mapping("acme");

// Mapping: Fuel, 8.1 transport (docs/mapping-decisions.md)
// | GEETA (neutral) input                 | Acme input               | Kind  | Basis                                   |
// | fuel purchased[].fuel type q          | purchases[].type         | ↦     | mapping.json lookups["fuel type q"]    |
// | fuel purchased[].amount purchased (L) | purchases[].kilolitres   | ÷1000 | GEETA unit L; Acme docs: kL             |
// | Result 8.1.1.1 (1) CO2, CH4 (t)       | transport.co2Tonnes, .ch4Tonnes | = | Acme output docs: t of gas           |
export const fuel: Adapter = (input) => {
  const { inputs } = toNeutral(input);                     // { "fuel purchased": [{ "fuel type q", "amount purchased", "unit", ... }] }
  const purchases = [];
  for (const p of inputs["fuel purchased"]) {
    const type = m.lookup("fuel type q", p["fuel type q"]);   // mapping.json; undefined: left out, with a note
    if (type === undefined) continue;
    purchases.push({ type, kilolitres: p.unit === "L" ? p["amount purchased"] / 1000 : p["amount purchased"] });
  }
  const result = calc.fuel({ purchases });
  return {
    VEERG_8_1_1_1__1_FuelCombustionTransport_Result_CO2: result.transport.co2Tonnes,
    VEERG_8_1_1_1__1_FuelCombustionTransport_Result_CH4: result.transport.ch4Tonnes,
  };
};
```

### With Claude Code

Run `npx geeta-compare llm adapter Fuel` ("Using an LLM"), or open Claude Code in the workspace and ask it to "write
the adapter for Fuel" (or for an enterprise). The workspace's `CLAUDE.md`
gives it the steps above, the rules and [docs/mapping-decisions.md](docs/mapping-decisions.md). It reads the scenario
docs, the neutral format and your calculator's inputs (its package's types, or an API's OpenAPI document, which
`install` records in `geeta.lock.json`), writes the adapter with its mapping record, adds its choices to
`mapping.json` as `"proposed"` (never changing a `"provider"` decision), runs the test, and checks the mapping table.

Then review: `npx geeta-compare mapping` lists its proposals. Keep each one (set `"by": "provider"`), change it, or
reject it, and edit the adapter code as you like. Review the mapping before explaining any differences: a wrong mapping
looks exactly like a calculator defect.

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
