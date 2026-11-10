// Runs GAF-VEERG-Functions test cases (TestInput_*.json / TestResults_*.json) through one calculator (src/calculators).
// Usage: npx geeta-compare test [--calculator <id>] [TestName[:ScenarioName] ...]   (default: the workspace's calculator; nested tests:
// Group.Name, e.g. EntericMethane.Feedlot)
// Fixtures come from the pinned GEETA release (npm run geeta:fetch) or a local override (src/geeta-source.ts).
import { findTest, loadCases, readJson } from "./fixtures";
import { geetaLabel } from "./geeta-source";
import { resetDecisionUses } from "./mapping";
import { calculator } from "./calculators";
import { comparedResults } from "./calculators/types";
import { isExcluded, warnUnmatched } from "./comparison-config";
import { diagnoseCase } from "./explain/diagnose";

const { adapters, name: calculatorName, version, findings } = calculator();
console.log(`${calculatorName} ${version()} compared with ${geetaLabel()}`);
const requested = process.argv.slice(2).map((arg) => arg.split(":"));
const selection = requested.length ? requested : Object.keys(adapters).map((name) => [name]);
let failures = 0;
// Scenarios comparison.config.json leaves out of the comparison: not run, only counted
let excluded = 0;
/** Results compared (an adapter error counts its scenario's results). */
let compared = 0;
warnUnmatched(Object.keys(adapters));
// Differing results by how well the stored explanation is supported, and whether it was written against this evidence
const tally = { verified: 0, suspected: 0, unchecked: 0, unexplained: 0, stale: 0, unreviewed: 0 };

for (const [name, scenarioFilter] of selection) {
  const adapter = adapters[name];
  const test = findTest(name);
  if (!adapter || !test?.TestInputFile) {
    console.log(`\n${name}: SKIPPED (${!adapter ? "no adapter yet" : "no test entry in Test.json"})`);
    continue;
  }

  for (const { name: scenario, input, expected: all } of loadCases(test)) {
    // A partial (enterprise) adapter is compared only on the results of the modules it maps
    const expected = comparedResults(adapter, all);
    if (scenarioFilter && scenario !== scenarioFilter) continue;
    if (isExcluded(name, scenario)) {
      excluded++;
      continue;
    }
    console.log(`\n${name} (${test.TestID})${scenario ? ` - ${scenario}` : ""}`);
    if (!Object.keys(expected).length) {
      console.log("  no expected results for this scenario");
      continue;
    }
    let actual: Record<string, number | string | undefined>;
    resetDecisionUses();
    try {
      actual = adapter(input);
    } catch (error: any) {
      const reason = String(error?.issues ? JSON.stringify(error.issues.map((i: any) => i.message)) : error?.message ?? error);
      console.log(`  ERROR: ${reason.slice(0, 300)}`);
      // An adapter error leaves every result of the scenario unexplained
      failures += Object.keys(expected).length;
      compared += Object.keys(expected).length;
      tally.unexplained += Object.keys(expected).length;
      continue;
    }
    const diagnosis = diagnoseCase(name, scenario, input, expected, actual);
    const rows = Object.entries<number | string>(expected).map(([key, exp]) => {
      const act = actual[key];
      const numeric = typeof exp === "number" && typeof act === "number";
      const { differs, findings, record, check, review } = diagnosis.results[key];
      const status = !differs ? undefined : !record ? "unexplained" : !check ? "unchecked" : check.ok ? "verified" : "suspected";
      compared++;
      if (differs) failures++;
      if (status) tally[status]++;
      if (review === "stale" || review === "unreviewed") tally[review]++;
      return {
        result: key.replace(/^VEERG_/, "").replace(/_Result/, ""),
        expected: exp,
        actual: act ?? "(not calculated)",
        ratio: numeric && exp !== 0 ? (act / exp).toPrecision(6) : "",
        ok: !differs ? "PASS" : record ? `FAIL #${record.section ?? record.id}` : "FAIL ?",
        check: !status || status === "unexplained" ? "" : status === "unchecked" ? "-" : `${check!.ok ? "✓" : "✗ SUSPECT"} ${check!.kind}`,
        review: review && review !== "current" ? review : "",
        // Deterministic findings, abbreviated: the codes only (full text in the docs and explain bundles)
        auto: findings.filter((f) => f.code !== "ratio").map((f) => (f.code === "factor" ? f.text.replace(/^.*exactly /, "") : f.code)).join("; "),
      };
    });
    console.table(rows);
  }
}

console.log(
  failures
    ? `\n${failures} result(s) differ. Stored explanations (FAIL #n: section n of ${findings}): ` +
        `${tally.verified} verified by a numeric check (✓), ${tally.unchecked} with no check (-), ` +
        `${tally.suspected} suspect: the check fails (✗), ${tally.unexplained} unexplained (FAIL ?). ` +
        `${tally.stale} stale and ${tally.unreviewed} unreviewed (evidence differs from when the explanation was written). ` +
        `No LLM was used; ask for explanations with: npm run explain -- status`
    : compared
      ? `\nAll ${compared} results match`
      : "\nNothing was compared",
);

// Run with no tests named: also list the tests the plug-in has no adapter for yet
if (!requested.length) {
  const paths = (node: Record<string, any>, prefix = ""): string[] =>
    Object.entries(node).flatMap(([k, v]) => (v?.TestInputFile ? [`${prefix}${k}`] : v && typeof v === "object" ? paths(v, `${prefix}${k}.`) : []));
  const missing = paths(readJson("Test.json").Tests).filter((t) => !adapters[t]);
  if (missing.length) console.log(`No adapter yet for ${missing.length} test(s): ${missing.join(", ")}`);
}
if (excluded) console.log(`${excluded} scenario(s) excluded by comparison.config.json`);
process.exitCode = failures ? 1 : 0;
