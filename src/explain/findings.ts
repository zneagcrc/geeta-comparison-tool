// Automatic findings: deterministic facts about a difference between a calculator and GEETA, computed from the numbers alone
// (no explanation text, no LLM). They point at likely causes: an exact factor of 100 suggests a percentage used as a
// fraction, 265 a gas reported against a CO2e value, and so on.
import { REL_TOL, fmt } from "./checks";
import { calculator } from "../calculators";

export type Finding = { code: string; text: string };

/** Factors that commonly separate two implementations of the same equation. */
const SIGNATURES: [number, string][] = [
  [100, "×100: a percentage used as a fraction, or vice versa"],
  [0.01, "÷100: a percentage used as a fraction, or vice versa"],
  [1000, "×1000: kg vs tonnes"],
  [0.001, "÷1000: kg vs tonnes"],
  [365, "×365: per day vs per year"],
  [1 / 365, "÷365: per day vs per year"],
  [3.65, "×3.65: 365 days vs 100 (e.g. head used as days)"],
  [1 / 3.65, "÷3.65: 100 vs 365 days (e.g. head used as days)"],
  [28, "×28: CH4 vs CO2e (AR5 GWP 28)"],
  [1 / 28, "÷28: CO2e vs CH4 (AR5 GWP 28)"],
  [265, "×265: N2O vs CO2e (AR5 GWP 265)"],
  [1 / 265, "÷265: CO2e vs N2O (AR5 GWP 265)"],
  [44 / 28, "×44/28: N2O-N vs N2O"],
  [28 / 44, "×28/44: N2O vs N2O-N"],
  [44 / 12, "×44/12: C vs CO2"],
  [12 / 44, "×12/44: CO2 vs C"],
  [16 / 12, "×16/12: C vs CH4"],
  [12 / 16, "×12/16: CH4 vs C"],
  [2, "×2: counted twice"],
  [0.5, "×0.5: counted half"],
];

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
const ratioOf = (calculated: unknown, geeta: unknown) => {
  const a = num(calculated);
  const g = num(geeta);
  return a !== undefined && g !== undefined && g !== 0 ? a / g : undefined;
};

/** Findings for one differing result. */
const resultFindings = (geeta: unknown, calculated: unknown): Finding[] => {
  const C = calculator().name;
  const g = num(geeta);
  const a = num(calculated);
  if (g === undefined) return [];
  if (a === undefined) return [{ code: "not-calculated", text: `${C} returned no value for this result` }];
  if (g === 0) return [{ code: "geeta-zero", text: `GEETA is 0; ${C} gives ${fmt(a)}` }];
  if (a === 0) return [{ code: "calculator-zero", text: `${C} gives 0; GEETA ${fmt(g)}` }];
  if (Math.sign(a) !== Math.sign(g)) return [{ code: "sign", text: `${C} and GEETA have opposite signs` }];
  const r = a / g;
  const out: Finding[] = [];
  const signature = SIGNATURES.find(([f]) => Math.abs(r - f) <= REL_TOL * f);
  if (signature) out.push({ code: "factor", text: `${C} / GEETA = ${fmt(r)}, exactly ${signature[1]}` });
  else if (Math.abs(r - 1) < 0.001) out.push({ code: "small", text: `${C} / GEETA = ${fmt(r)}: under 0.1%, e.g. a rounded constant` });
  else out.push({ code: "ratio", text: `${C} / GEETA = ${fmt(r)}` });
  return out;
};

const methodOf = (key: string) => key.match(/_Method(\d)/)?.[1];
const baseOf = (key: string) => key.replace(/_Method\d/, "").replace(/_CO2e$/, "");

/**
 * Findings for every differing result of one scenario, including patterns across the scenario: differences confined to
 * one method, a ratio shared by every differing result, or one shared by a result's gas and CO2e values.
 */
export const scenarioFindings = (expected: Record<string, unknown>, actual: Record<string, unknown>, differs: (key: string) => boolean) => {
  const keys = Object.keys(expected).filter(differs);
  const findings = new Map<string, Finding[]>(keys.map((k) => [k, resultFindings(expected[k], actual[k])]));

  // This result differs in one method while the same result in the other method matches
  const otherMethodMatches = (k: string) => {
    const m = methodOf(k);
    const twin = m && Object.keys(expected).find((x) => x !== k && baseOf(x) === baseOf(k) && methodOf(x) !== m && x.endsWith("_CO2e") === k.endsWith("_CO2e"));
    return twin && !differs(twin);
  };
  for (const k of keys)
    if (otherMethodMatches(k)) findings.get(k)!.push({ code: "one-method", text: `Only Method ${methodOf(k)} differs; the other method matches` });

  // One ratio across every differing result of the scenario: a single factor upstream of all of them
  const ratios = keys.map((k) => ratioOf(actual[k], expected[k]));
  if (keys.length > 1 && ratios.every((r) => r !== undefined && Math.abs(r - ratios[0]!) <= REL_TOL * Math.abs(ratios[0]!)))
    for (const k of keys)
      findings.get(k)!.push({ code: "common-ratio", text: `All ${keys.length} differing results in this scenario share this ratio: one factor upstream` });
  else
    // Gas and CO2e values with the same ratio: the cause is upstream of the GWP
    for (const k of keys.filter((x) => x.endsWith("_CO2e"))) {
      const gas = k.replace(/_CO2e$/, "");
      const rg = ratioOf(actual[gas], expected[gas]);
      const rc = ratioOf(actual[k], expected[k]);
      if (rg !== undefined && rc !== undefined && Math.abs(rg - rc) <= REL_TOL * Math.abs(rg))
        findings.get(k)!.push({ code: "same-as-gas", text: "Same ratio as the gas value: the cause is upstream of the GWP" });
    }
  return findings;
};
