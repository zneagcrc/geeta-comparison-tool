// What a calculator plug-in provides. A run compares one calculator with GEETA (the workbook's expected results); each
// calculator has its own adapters, explanation store, findings document and scenario docs. See README.md, "Adding a
// calculator".

/**
 * Takes a VEERG test input and returns the calculator's results keyed the same as the VEERG TestResults file, plus
 * `PROBE:<result>` values for numeric checks. Synchronous: a calculator run out of process (a CLI, Python, a
 * spreadsheet) is called with a synchronous subprocess (child_process.execFileSync).
 */
export type Adapter = (input: any) => Record<string, number | string | undefined>;

/** An adapter that maps only some of a test's results (e.g. an enterprise entry point): compared on those only. */
export type PartialAdapter = Adapter & { covers: RegExp[] };

/** The expected results an adapter is compared on: all of them, or for a partial adapter those it covers. */
export const comparedResults = <T>(adapter: Adapter, expected: Record<string, T>): Record<string, T> => {
  const covers = (adapter as Partial<PartialAdapter>).covers;
  return covers ? Object.fromEntries(Object.entries(expected).filter(([k]) => covers.some((r) => r.test(k)))) : expected;
};

/** One input the adapter gave the calculator (a schema parse, a request, a file), shown in the scenario docs. */
export type InputCall = { schema: string; input: unknown };

export type Calculator = {
  /** Selects it (`--calculator <id>`), names its folders (explanations/<id>/) and keys its evidence fingerprints. */
  id: string;
  /** How reports, docs and explanation types name it ("<name> defect", "<name> coverage gap"). */
  name: string;
  /** The calculator's version. It is part of every evidence fingerprint: a new version marks explanations stale. */
  version: () => string;
  /** Adapters by Test.json path (nested tests: Group.Name). */
  adapters: Record<string, Adapter>;
  /** Folder of the adapter sources (relative to the workspace): an adapter is read from <adapterDir>/<function name>.ts. */
  adapterDir: string;
  /** Findings document (relative to the workspace): explanation records' `section` refers to its numbered sections. */
  findings: string;
  /** Scenario docs folder (relative to the workspace). */
  docsDir: string;
  /**
   * Runs fn for real (the calculator calculates) and returns its result with the inputs the calculator was given
   * meanwhile: shown in the scenario docs, and what the docs' mapping trace compares. (Formerly captureInputs.)
   */
  calculateAndCaptureInputs?: <T>(fn: () => T) => { result: T; inputs: InputCall[] };
  /**
   * Optional and risky: the inputs the calculator is given while fn runs, with the calculation skipped (fn's result is
   * meaningless). When set, the mapping trace uses it instead of calculateAndCaptureInputs, which is faster but wrong
   * whenever an adapter builds an input from a result, branches on one, or the calculator rejects an input only while
   * calculating. Leave it out unless none of that can happen. (Formerly captureInputsOnly.)
   */
  captureInputsWithoutCalculating?: (fn: () => unknown) => InputCall[];
  /** Calculator source files an adapter's source text refers to, listed in explanation bundles. */
  sourceFiles?: (adapterSource: string) => string[];
  /** VEERG results from a neutral scenario, by test (src/neutral/cli.ts `results`). */
  neutralResults?: Record<string, (scenario: any) => Record<string, unknown>>;
};

/**
 * What a plug-in module default-exports. The rest comes from the calculator's entry in geeta.config.json: `id` (its
 * key), `name`, the `version` that `geeta-compare install` recorded in geeta.lock.json, and the default paths
 * (adapterDir `calculators/<id>`, findings `findings/<id>.md`, docsDir `docs/<id>`). A plug-in can still set any of
 * them, e.g. `version()` for an API that reports its own version.
 */
export type CalculatorPlugin = Omit<Calculator, "id" | "name" | "version" | "adapterDir" | "findings" | "docsDir"> &
  Partial<Pick<Calculator, "id" | "name" | "version" | "adapterDir" | "findings" | "docsDir">> & {
    /** @deprecated The old name of calculateAndCaptureInputs; still read. */
    captureInputs?: Calculator["calculateAndCaptureInputs"];
    /** @deprecated The old name of captureInputsWithoutCalculating; still read. */
    captureInputsOnly?: Calculator["captureInputsWithoutCalculating"];
  };
