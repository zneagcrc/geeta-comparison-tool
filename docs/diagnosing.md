# Diagnosing a difference

When your calculator and GEETA disagree on a result and no stored explanation covers it, find out which side follows
the methodology, and why the other doesn't. Paths are in the downloaded release (`geeta-releases/<release>/`).

1. **Read the automatic findings first.** An exact ×100, ×1000 or GWP factor, a result not calculated, a difference
   confined to one method, or one ratio shared across a scenario usually names the cause (a unit, a constant, a
   missing branch) before any reading.
2. **Reproduce GEETA's calculation by hand** from the equations (`Modules/**/*_Equations.xlf`) and the source data
   (`generated-sourcedata/*.json`, `Modules/**/*_SourceData.xlf`), with the scenario's resolved inputs (the bundle's
   `.inputs.json`). If your hand calculation matches your calculator but not GEETA, look at the workbook next.
3. **Read the workbook's formulas and cached values** straight from the `.xlsx` (no Excel needed:
   `tools/xlsxf.py`, `tools/cellformula.py`). The generated test workbooks in `TestExcel/` hold the cached values for
   the test inputs. If the cached total disagrees with `TestResults`, the expected result itself is in question.
4. **Check the methodology text** (your copy of the VEERG documents) when the two sides implement different equations,
   constants or defaults. Cite the clause, equation or table of the latest version.
5. **Build a numeric check.** Prefer `reproduces`: add a `PROBE:<result name>` value to your adapter that recomputes the
   result with the cause corrected; it must equal GEETA. Otherwise `ratio` (the factor the cause implies) or `bound`.
   Building the check is what confirms the explanation: if it doesn't reproduce GEETA, the explanation is wrong or
   incomplete.

Kinds of difference (`type` in an explanation): `<name> defect` (your calculator departs from the methodology),
`<name> coverage gap` (an input or branch your calculator doesn't support), `Method difference` (the two read the
methodology differently, or it allows both), `Data version` (different editions of a factor table), `Constant
convention` (e.g. 44/28 vs 1.57), `Workbook defect` (GEETA departs from the methodology), `Adapter defect` (your
adapter maps an input wrongly), `Other`.
