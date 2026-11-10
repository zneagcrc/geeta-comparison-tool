// Numeric checks that an explanation fits the numbers. Stored as data with each explanation (explanations/<calculator>/*.json), and
// evaluated deterministically:
//   reproduces - the adapter recomputes the value with the explained cause corrected and returns it as
//                "PROBE:<result name>"; passes when that equals GEETA.
//   ratio      - calculator / GEETA equals one of the given factors (labels say where each factor comes from).
//   bound      - calculator / GEETA lies within [lo, hi]: direction and rough size only.
import { calculator } from "../calculators";

export type CheckSpec =
  | { kind: "reproduces"; what: string }
  | { kind: "ratio"; factors: Record<string, number> }
  | { kind: "bound"; lo: number; hi: number; what: string };

export type CheckResult = { ok: boolean; kind: CheckSpec["kind"]; detail: string };
export type CheckContext = { geeta: number; calculated: number | undefined; probe: number | undefined };

// Same tolerance as the runner
export const REL_TOL = 1e-6;
export const ABS_TOL = 1e-12;
export const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(ABS_TOL, REL_TOL * Math.max(Math.abs(a), Math.abs(b)));
export const fmt = (x: number | undefined) => (x === undefined ? "not calculated" : String(Number(x.toPrecision(6))));

export const evaluateCheck = (spec: CheckSpec, { geeta, calculated, probe }: CheckContext): CheckResult => {
  const C = calculator().name;
  switch (spec.kind) {
    case "reproduces":
      return probe === undefined
        ? { ok: false, kind: spec.kind, detail: `${spec.what}: the adapter returned no recomputed value` }
        : { ok: close(probe, geeta), kind: spec.kind, detail: `${spec.what}: ${fmt(probe)} vs GEETA ${fmt(geeta)}` };
    case "ratio": {
      if (calculated === undefined || geeta === 0) return { ok: false, kind: spec.kind, detail: `${C} / GEETA can't be formed` };
      const r = calculated / geeta;
      const ok = Object.values(spec.factors).some((f) => Math.abs(r - f) <= REL_TOL * Math.abs(f));
      const expected = Object.entries(spec.factors).map(([label, f]) => `${label} = ${fmt(f)}`).join(" or ");
      return { ok, kind: spec.kind, detail: `${C} / GEETA = ${fmt(r)}; expected ${expected}` };
    }
    case "bound": {
      if (calculated === undefined || geeta === 0) return { ok: false, kind: spec.kind, detail: `${C} / GEETA can't be formed` };
      const r = calculated / geeta;
      return { ok: r >= spec.lo && r <= spec.hi, kind: spec.kind, detail: `${C} / GEETA = ${fmt(r)}; ${spec.what} expects ${spec.lo}–${spec.hi}` };
    }
  }
};
