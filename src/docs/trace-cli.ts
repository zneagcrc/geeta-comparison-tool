// geeta-compare mapping trace [Test ...]: traces how each neutral input of every scenario reaches the GEETA workbook and
// the calculator (the mapping table of the scenario docs), for the tests named or all of them. Each input is changed in
// turn and the calculator's inputs regenerated, so this runs the calculator once per value tried: slow the first time,
// but only once. Traces are cached in <docsDir>/.mapping-cache.json and stay current until
// a test's adapter input or the calculator version changes. `geeta-compare docs` needs them all.
import { buildModel } from "./scenario-model";
import { mappingCacheFile, saveMappingCache, traceStats } from "./mapping";
import { calculator } from "../calculators";

const args = process.argv.slice(2);
const tests = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--calculator");
const calc = calculator();

console.error(
  `Tracing the mapping of ${tests.length ? tests.join(", ") : "every test"} into ${mappingCacheFile(calc)}. ` +
    `Scenarios already traced are skipped; the others run ${calc.name} once per input value tried` +
    (calc.captureInputsWithoutCalculating
      ? " without calculating (the plug-in's captureInputsWithoutCalculating)."
      : ", so the first run can take a long time; the traces are kept until the adapter or the calculator version changes.") +
    " Stopping early keeps what was traced.",
);
const started = Date.now();
buildModel({ tests, trace: true });
// A full run drops traces of scenarios that no longer exist (or whose adapter input changed)
saveMappingCache(!tests.length);
const minutes = ((Date.now() - started) / 60_000).toFixed(1);
console.log(`Mapping traced: ${traceStats.traced} scenario(s) traced, ${traceStats.cached} already current (${minutes} min). Next: npx geeta-compare docs`);
