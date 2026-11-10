// Loading the GEETA test fixtures (TestInput_*.json / TestResults_*.json), shared by the test runner and the neutral
// scenario tools. They come from the pinned GEETA release (npm run geeta:fetch) or a local override: geeta-source.ts.
import fs from "node:fs";
import path from "node:path";
import { TEST_DIR, requireTestSet } from "./geeta-source";

export { TEST_DIR };

export const readJson = (rel: string) => {
  requireTestSet();
  return JSON.parse(fs.readFileSync(path.join(TEST_DIR, rel), "utf8"));
};

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

/** Test.json entry for a name like "Fuel" or "ManureManagement.Poultry". */
export const findTest = (name: string) => name.split(".").reduce((node: any, key) => node?.[key], readJson("Test.json").Tests);

/**
 * Deep-merges a scenario onto its base, as create-test-excel-from-json.ps1 (Merge-InputTables) does: cells override;
 * tables match by TableName (the last base table with that name) and their Cols/Rows merge column-by-column and
 * field-by-field; other table properties overwrite. With "Replace": true, the override table's Cols/Rows replace the
 * base's wholesale. Unmatched override tables are appended.
 */
export const mergeScenario = (base: any, over: any) => {
  const merged = { ...structuredClone(base), ...structuredClone(over) };
  const tables: any[] = structuredClone(base.InputTables ?? []);
  for (const table of over.InputTables ?? []) {
    const existing = tables.findLast((t) => t.TableName === table.TableName);
    if (!existing) {
      tables.push(structuredClone(table));
      continue;
    }
    for (const [key, value] of Object.entries<any>(structuredClone(table))) {
      const columnMap = (key === "Cols" || key === "Rows") && isObject(existing[key]) && isObject(value);
      if (columnMap && !table.Replace)
        for (const [col, fields] of Object.entries<any>(value))
          existing[key][col] = isObject(existing[key][col]) && isObject(fields) ? { ...existing[key][col], ...fields } : fields;
      else existing[key] = value;
    }
  }
  merged.InputTables = tables;
  return merged;
};

export type TestCase = { name: string | undefined; input: any; expected: Record<string, number | string> };

/** Returns [{ name, input, expected }] for a test, resolving scenario files and ScenarioExtends chains. */
export const loadCases = (test: any): TestCase[] => {
  const input = readJson(test.TestInputFile);
  const results = readJson(test.TestResultsFile);
  const dir = path.dirname(test.TestInputFile);
  const scenarios: any[] =
    input.Scenarios ?? input.ScenarioFiles?.map((f: string) => readJson(path.join(dir, f)));
  if (!scenarios) return [{ name: undefined, input, expected: results }];

  const byName = new Map(scenarios.map((s) => [s.ScenarioName, s]));
  const resolve = (s: any, seen = new Set<string>()): any => {
    if (!s.ScenarioExtends) return s;
    if (seen.has(s.ScenarioName)) throw new Error(`Circular ScenarioExtends at ${s.ScenarioName}`);
    const base = byName.get(s.ScenarioExtends);
    if (!base) throw new Error(`${s.ScenarioName} extends unknown scenario ${s.ScenarioExtends}`);
    return mergeScenario(resolve(base, new Set([...seen, s.ScenarioName])), s);
  };
  const expectedByName = new Map((results.Scenarios ?? []).map((r: any) => [r.ScenarioName, r]));
  return scenarios.map((s) => {
    // NIRResults holds National Inventory Report values for the docs; they aren't GEETA results
    const { ScenarioName, NIRResults, ...expected } = (expectedByName.get(s.ScenarioName) ?? {}) as any;
    return { name: s.ScenarioName as string, input: resolve(s), expected };
  });
};
