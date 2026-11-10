# Calculators compared with GEETA

This workspace compares emissions calculators with GEETA (the VEERG calculation workbooks) using geeta-comparison-tool
(`node_modules/geeta-comparison-tool`, README.md there). The calculators are defined in `geeta.config.json`
("calculators"); `npx geeta-compare install <id>` installs one, records its version in `geeta.lock.json`, and creates
its plug-in (`calculators/<id>/index.ts`) and findings document (`findings/<id>.md`).

- `npm run test:veerg` and `npm run docs:scenarios` are deterministic and use no LLM. Explanation text only comes from
  the store in `explanations/<id>/`.
- With several calculators, pass `--calculator <id>` to every command below (or set "calculator" in geeta.config.json).
- The GEETA test set is the release pinned in `geeta.config.json` (`npm run geeta:fetch`) unless `GEETA_DIR` or
  `geeta.local.json` overrides it. The first line of every run says which calculator version and test set it used.
- Scenarios listed in `comparison.config.json` are excluded from the comparison: don't run, explain or document them,
  and don't count their results.
- Never change a calculator's installed release (`node_modules`) to make it match: differences are explained, not
  patched. A calculator is upgraded only by changing its "version" and running `npx geeta-compare install <id>`.

## Writing an adapter (when asked)

When asked to write or extend an adapter ("write the adapter for Fuel", "add Enterprises.CroppingGrains"), follow
"Developing adapters" in `node_modules/geeta-comparison-tool/README.md`:

1. Read what the test holds, from sources without GEETA's expected values: the neutral scenarios
   (`npx geeta-compare neutral export <Test>`, then `scenarios/<module>/`), the input labels, units and options in the
   release (`geeta-releases/<release>/InputFields/`), the result names (`npx geeta-compare names <Test>`), and the
   catalogue and equations (`node_modules/geeta-comparison-tool/catalogue/veerg-inputs.md`, the release's
   `Modules/**/*.xlf`). Workbook formulas: `python -I node_modules/geeta-comparison-tool/tools/cellformula.py ...` (or
   `xlsxf.py`; `py -I` if `python` isn't the command). Don't open the scenario docs, `TestResults_*.json` or `test`
   output until the adapter is written: they show the expected values.
2. Read the calculator's inputs: its package's types and documentation, or for an API the OpenAPI document recorded in
   `geeta.lock.json` (the endpoint's request schema and result format).
3. Write the adapter in the calculator's plug-in folder: convert with `moduleFor("<Test>")!.fromVeerg(input)`, map onto
   the calculator's inputs, return its results under GEETA's result names and units. Decide each field as
   `node_modules/geeta-comparison-tool/docs/mapping-decisions.md` sets out (direct, unit conversion, lookup, reshape,
   combine or split, derived, calculator default, no equivalent, ambiguous), from the definitions on both sides.
   Choices (code lookups, defaults, readings of ambiguous definitions) go in the plug-in's `mapping.json` and are read
   with `mapping("<id>")` (`m.lookup`, `m.default`, `m.assumption`): add each one with `"by": "proposed"` and its
   evidence as the `reason`, and tie each lookup table to its GEETA field (`"geeta"`; for options that depend on another field, the parent value in
   brackets, e.g. `"Table_Input_Fuel.FuelType[Generators]"`). Everything else (direct copies,
   unit conversions, reshaping, derived values) is code, listed in the mapping record at the top of the adapter. For
   an input the calculator can't take, propose `"to": null` with the reason; never drop one silently. A partial
   adapter gets `covers`.
4. Run `npm run typecheck`, `npx geeta-compare test <Test>` and `npx geeta-compare mapping <Test>`, regenerate the
   docs and check the mapping table: every "Not used by" input must be deliberate and have a note.
5. Report what the adapter maps, what it leaves out, the decisions you proposed (they wait for the provider's
   review), and the remaining differences. Don't explain them unless asked.

`mapping.json` belongs to the calculator's provider. Never change or remove an entry marked `"by": "provider"`, and
never mark one of your own as `"provider"`: if a provider decision looks wrong, say so in your report. When an adapter
is written again (after an upgrade, say), keep the provider's decisions and propose only for what is new.

Never use GEETA's expected values while writing an adapter, and never adjust a conversion until results match: map
what the inputs mean, then let the comparison show the differences. An adapter translates and never calculates
emissions: no emission factors, GWPs or methodology equations in it (they are the calculator's). When a mapping is
ambiguous, choose the reading the definitions support, record it as an assumption, and say so in your report.

## Explaining differences (only when asked)

When asked to explain differences ("explain ManureManagement.Pigs", "explain the differences in
explanations/<id>/requests/…md"):

1. Run `npm run explain -- bundle <Test>[:<Scenario>]` if no bundle was given, then read the bundle.
2. **Start from the stored explanations** listed in the bundle (`explanations/<id>/<Test>.json`, every explanation
   ever recorded, including superseded ones). For each differing result:
   - check passes and review is `current`: the explanation stands. Say so; don't rewrite it.
   - check passes but review is `stale` / `unreviewed`: confirm nothing in the new evidence contradicts it, then
     re-record it unchanged with `supersedes` so it is current again.
   - check fails (suspect), no explanation, or no check: diagnose
     (`node_modules/geeta-comparison-tool/docs/diagnosing.md`). Earlier explanations, including superseded ones, are
     leads, not answers.
3. Record each explanation with a draft JSON file and `npm run explain -- add <draft.json>` (format in the bundle).
   `add` computes the evidence fingerprints and refuses a draft whose check fails. Never edit
   `explanations/<id>/*.json` by hand: records are append-only so the history stays.
4. Give every explanation a numeric check where the numbers allow it. Prefer `reproduces`: add a `PROBE:<result name>`
   value to the adapter that recomputes the result with the cause corrected (it must equal GEETA). Then `ratio`, then
   `bound`. Building a check can expose a wrong explanation, so don't skip it.
5. Cite what each explanation relies on in `sources`: the methodology document the bundle marks "cite" (with the
   clause, equation or table; never an older version), the calculator's own files, workbook cells and source-data
   tables. When the bundle has no methodology documents, cite the `.xlf` equations and workbook cells, and quote
   nothing from the documents.
6. Write or update the numbered section in the calculator's findings document (`findings/<id>.md`) and reference it in
   `section`.
7. Re-run `npm run test:veerg` and confirm the results show `✓` and no `stale` / `unreviewed`.

Draft files are scratch: keep them out of the workspace (a temporary folder).
