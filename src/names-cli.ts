// geeta-compare names <Test>: the GEETA result names a test's scenarios have, without their values, for writing an
// adapter without seeing what the results should be. Results that only some scenarios have are marked.
import { findTest, loadCases } from "./fixtures";
import { isExcluded } from "./comparison-config";

const name = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!name) {
  console.error("Usage: geeta-compare names <Test>   e.g. geeta-compare names Fuel");
  process.exit(1);
}
const test = findTest(name);
if (!test?.TestInputFile) {
  console.error(`No test ${name} in this GEETA test set`);
  process.exit(1);
}
const cases = loadCases(test).filter((c) => !isExcluded(name, c.name));
const count = new Map<string, number>();
for (const c of cases) for (const k of Object.keys(c.expected)) count.set(k, (count.get(k) ?? 0) + 1);
console.log(`${name}: ${count.size} result name(s) across ${cases.length} scenario(s) (values not shown)`);
for (const [k, n] of count) console.log(`  ${k}${n < cases.length ? `   (in ${n} of ${cases.length} scenarios)` : ""}`);
