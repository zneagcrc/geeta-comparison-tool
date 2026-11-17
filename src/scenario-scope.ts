// Default scenarios only: each test's first scenario ("Default" / "Default scenario"; a test without named scenarios is
// its own default), for a quick first pass that finds the big problems before running every scenario. On with
// "runDefaultScenariosOnly": true in comparison.config.json, --default-only on a command, or GEETA_DEFAULT_ONLY=1.
// `test`, `mapping trace`, `mapping`, `docs`, `explain` and `neutral check` follow it.
//
// It only narrows what a run looks at; it removes nothing. A trace limited this way doesn't prune the trace cache, the
// docs say they're limited, and explanations of other scenarios stay in the store untouched.
import fs from "node:fs";
import { inWorkspace } from "./workspace";

const FLAG = "--default-only";
// Taken off the command line (commands read their arguments as test names), and passed on to worker processes
if (process.argv.includes(FLAG)) {
  process.argv.splice(process.argv.indexOf(FLAG), 1);
  process.env.GEETA_DEFAULT_ONLY = "1";
}

let fromConfig: boolean | undefined;
const configSays = () => {
  if (fromConfig === undefined) {
    const file = inWorkspace("comparison.config.json");
    try {
      fromConfig = fs.existsSync(file) && JSON.parse(fs.readFileSync(file, "utf8")).runDefaultScenariosOnly === true;
    } catch {
      fromConfig = false;
    }
  }
  return fromConfig;
};

/** Whether this run looks at each test's default scenario only. */
export const defaultOnly = () => (process.env.GEETA_DEFAULT_ONLY ? process.env.GEETA_DEFAULT_ONLY !== "0" : configSays());

/** Whether the scenario at this position in its test is in this run (the first is the default). */
export const inScope = (index: number) => !defaultOnly() || index === 0;

/** For run headers: why scenarios are missing, or "". */
export const scopeNote = () =>
  defaultOnly()
    ? ` (default scenarios only: ${process.env.GEETA_DEFAULT_ONLY ? (process.env.GEETA_DEFAULT_ONLY === "1" ? "--default-only or GEETA_DEFAULT_ONLY" : "GEETA_DEFAULT_ONLY") : "runDefaultScenariosOnly in comparison.config.json"})`
    : "";
