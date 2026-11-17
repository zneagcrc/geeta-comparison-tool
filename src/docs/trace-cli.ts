// geeta-compare mapping trace [Test ...] [--jobs N]: traces how each neutral input of every scenario reaches the GEETA
// workbook and the calculator (the mapping table of the scenario docs), for the tests named or all of them. Inputs are
// changed and the calculator's inputs regenerated, so this runs the calculator many times per scenario: slow the first
// time, but only once. Traces are cached in <docsDir>/.mapping-cache.json and stay current until a test's adapter input
// or the calculator version changes. `geeta-compare docs` needs them all.
//
// Scenarios are traced by N worker processes at once (--jobs N, or GEETA_TRACE_JOBS; by default up to 4, one fewer than
// the processors): each claims the scenarios it traces, writes its traces to a shard of its own, and this process merges
// the shards into the cache when they finish. --jobs 1 traces in this process.
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { buildModel } from "./scenario-model";
import { mappingCacheFile, mergeTraceShards, progress, saveMappingCache, traceStats, worker } from "./mapping";
import { calculator } from "../calculators";
import { inWorkspace } from "../workspace";

const args = process.argv.slice(2);
const valued = new Set(["--calculator", "--jobs"]);
const tests = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
const calc = calculator();

const jobs = (() => {
  const given = args.includes("--jobs") ? args[args.indexOf("--jobs") + 1] : (args.find((a) => a.startsWith("--jobs="))?.slice(7) ?? process.env.GEETA_TRACE_JOBS);
  if (given !== undefined) {
    const n = Number(given);
    if (!Number.isInteger(n) || n < 1) {
      console.error(`--jobs takes a whole number of at least 1, not "${given}"`);
      process.exit(1);
    }
    return n;
  }
  const cpus = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
  return Math.max(1, Math.min(4, cpus - 1));
})();

const minutes = (ms: number) => (ms / 60_000).toFixed(1);
const summary = (started: number) => {
  const s = traceStats;
  const runs = s.runs
    ? ` ${s.runs} runs of ${calc.name} (${s.ms ? Math.round((100 * s.calcMs) / s.ms) : 0}% of the tracing time in ${calc.name}); ` +
      `${s.batched} of ${s.inputs} inputs settled in batches.`
    : "";
  console.log(
    `Mapping traced: ${s.traced} scenario(s) traced, ${s.cached} already current (${minutes(Date.now() - started)} min).${runs} Next: npx geeta-compare docs`,
  );
};

const intro = () =>
  console.error(
    `Tracing the mapping of ${tests.length ? tests.join(", ") : "every test"} into ${mappingCacheFile(calc)}` +
      (jobs > 1 ? `, ${jobs} scenarios at a time (--jobs)` : "") +
      `. Scenarios already traced are skipped; the others run ${calc.name} for the input values tried (many at once where they can be told apart, ` +
      `using what earlier traces found)` +
      (calc.captureInputsWithoutCalculating
        ? ", without calculating where the plug-in's captureInputsWithoutCalculating gives the same inputs."
        : ", so the first run can take a long time; the traces are kept until the adapter or the calculator version changes.") +
      " Stopping early keeps what was traced.",
  );

const main = async () => {
  if (worker) {
    // One of the workers: trace what it claims, then write its shard
    buildModel({ tests, trace: true });
    saveMappingCache();
    return;
  }
  const started = Date.now();
  intro();
  if (jobs === 1) {
    buildModel({ tests, trace: true });
    // A full run drops traces of scenarios that no longer exist (or whose adapter input changed)
    saveMappingCache(!tests.length);
    return summary(started);
  }
  // Shards an interrupted run left are merged first, so the workers start from every trace there is
  mergeTraceShards(calc);
  const claims = inWorkspace(calc.docsDir, ".mapping-claims");
  fs.rmSync(claims, { recursive: true, force: true });
  fs.mkdirSync(claims, { recursive: true });
  const tsx = require.resolve("tsx/cli");
  const codes = await Promise.all(
    Array.from({ length: jobs }, (_, i) =>
      new Promise<number>((resolve) => {
        // The calculator chosen here (--calculator was taken off the command line when it was read)
        const child = spawn(process.execPath, [tsx, __filename, ...args, "--calculator", calc.id], {
          stdio: "inherit",
          env: { ...process.env, GEETA_TRACE_WORKER: `${i + 1}/${jobs}`, GEETA_TRACE_CLAIMS: claims },
        });
        child.on("exit", (code) => resolve(code ?? 1));
        child.on("error", () => resolve(1));
      }),
    ),
  );
  fs.rmSync(claims, { recursive: true, force: true });
  const failed = codes.filter((c) => c !== 0).length;
  // A full run every worker finished drops traces of scenarios that no longer exist (or whose adapter input changed)
  mergeTraceShards(calc, { counts: true, prune: !tests.length && !failed });
  if (failed) {
    progress(`${failed} of ${jobs} workers stopped early; what they traced is kept in ${mappingCacheFile(calc)}, so run it again to finish`);
    process.exitCode = 1;
  }
  summary(started);
};

main();

// Ctrl+C reaches the workers too; each keeps what it traced in its shard, which the next run merges
process.on("SIGINT", () => {
  if (worker) saveMappingCache();
  process.exit(130);
});
