// Deterministic diagnosis of one test scenario: which results differ, the automatic findings, and the stored
// explanation with its numeric check and whether it was written against the current evidence. Shared by the test
// runner and the scenario docs. No LLM is involved; explanation text only comes from the store.
import { type CheckResult, ABS_TOL, REL_TOL, evaluateCheck } from "./checks";
import { type Finding, scenarioFindings } from "./findings";
import { type ExplanationRecord, fingerprint, selectRecord } from "./store";

/** current: written against this exact evidence; stale: evidence has changed since; unreviewed: never written against this scenario. */
export type Review = "current" | "stale" | "unreviewed";

export type ResultDiagnosis = {
  differs: boolean;
  findings: Finding[];
  record?: ExplanationRecord;
  check?: CheckResult;
  review?: Review;
};

export type CaseDiagnosis = { fingerprint: string; results: Record<string, ResultDiagnosis> };

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);

/** Same comparison as the runner: numbers within tolerance, anything else strictly equal. */
export const sameValue = (exp: unknown, act: unknown) =>
  typeof exp === "number" && typeof act === "number"
    ? Math.abs(act - exp) <= Math.max(ABS_TOL, REL_TOL * Math.max(Math.abs(exp), Math.abs(act)))
    : // The workbook reports "No data" for a result it has no factors for; the calculator calculating nothing agrees with that
      act === exp || (exp === "No data" && act === undefined);

export const diagnoseCase = (
  test: string,
  scenario: string | undefined,
  input: unknown,
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): CaseDiagnosis => {
  const print = fingerprint(input, expected, actual);
  const differs = (k: string) => !sameValue(expected[k], actual[k]);
  const findings = scenarioFindings(expected, actual, differs);
  const results: Record<string, ResultDiagnosis> = {};
  for (const key of Object.keys(expected)) {
    if (!differs(key)) {
      results[key] = { differs: false, findings: [] };
      continue;
    }
    const record = selectRecord(test, scenario, key);
    const geeta = num(expected[key]);
    const check =
      record?.check && geeta !== undefined
        ? evaluateCheck(record.check, { geeta, calculated: num(actual[key]), probe: num(actual[`PROBE:${key}`]) })
        : undefined;
    const written = record?.evidence[scenario ?? ""];
    results[key] = {
      differs: true,
      findings: findings.get(key) ?? [],
      record,
      check,
      review: record ? (written === undefined ? "unreviewed" : written === print ? "current" : "stale") : undefined,
    };
  }
  return { fingerprint: print, results };
};
