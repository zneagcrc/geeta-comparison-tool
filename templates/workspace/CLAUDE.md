# {{name}} compared with GEETA

This workspace compares {{name}} with GEETA (the VEERG calculation workbooks) using geeta-comparison-tool
(`node_modules/geeta-comparison-tool`, README.md there). The plug-in is `calculator/index.ts`; findings are in
`findings.md`.

- `npm run test:veerg` and `npm run docs:scenarios` are deterministic and use no LLM. Explanation text only comes from
  the store in `explanations/{{id}}/`.
- The GEETA test set is the release pinned in `geeta.config.json` (`npm run geeta:fetch`) unless `GEETA_DIR` or
  `geeta.local.json` overrides it. The first line of every run says which test set it used.
- Scenarios listed in `comparison.config.json` are excluded from the comparison: don't run, explain or document them,
  and don't count their results.

## Explaining differences (only when asked)

When asked to explain differences ("explain ManureManagement.Pigs", "explain the differences in
explanations/{{id}}/requests/…md"):

1. Run `npm run explain -- bundle <Test>[:<Scenario>]` if no bundle was given, then read the bundle.
2. **Start from the stored explanations** listed in the bundle (`explanations/{{id}}/<Test>.json`, every explanation
   ever recorded, including superseded ones). For each differing result:
   - check passes and review is `current`: the explanation stands. Say so; don't rewrite it.
   - check passes but review is `stale` / `unreviewed`: confirm nothing in the new evidence contradicts it, then
     re-record it unchanged with `supersedes` so it is current again.
   - check fails (suspect), no explanation, or no check: diagnose
     (`node_modules/geeta-comparison-tool/docs/diagnosing.md`). Earlier explanations, including superseded ones, are
     leads, not answers.
3. Record each explanation with a draft JSON file and `npm run explain -- add <draft.json>` (format in the bundle).
   `add` computes the evidence fingerprints and refuses a draft whose check fails. Never edit
   `explanations/{{id}}/*.json` by hand: records are append-only so the history stays.
4. Give every explanation a numeric check where the numbers allow it. Prefer `reproduces`: add a `PROBE:<result name>`
   value to the adapter that recomputes the result with the cause corrected (it must equal GEETA). Then `ratio`, then
   `bound`. Building a check can expose a wrong explanation, so don't skip it.
5. Cite what each explanation relies on in `sources`: the methodology document the bundle marks "cite" (with the
   clause, equation or table; never an older version), {{name}}'s own files, workbook cells and source-data tables.
   When the bundle has no methodology documents, cite the `.xlf` equations and workbook cells, and quote nothing from
   the documents.
6. Write or update the numbered section in `findings.md` and reference it in `section`.
7. Re-run `npm run test:veerg` and confirm the results show `✓` and no `stale` / `unreviewed`.

Draft files are scratch: keep them out of the workspace (a temporary folder).
