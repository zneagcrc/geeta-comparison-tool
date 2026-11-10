// Mapping decisions as data: calculators/<id>/mapping.json, owned by the calculator provider. Adapters look decisions
// up here instead of hard-coding them, so a provider can make or change every decision without touching code, and a
// decision missing from the file is reported as a gap, never guessed. See docs/mapping-decisions.md.
//
//   {
//     "lookups": {                          // categorical values: GEETA value -> calculator value
//       "fuel type q": {
//         "geeta": "Table_Input_Fuel.FuelType",   // optional: the GEETA field, so every option is checked
//         "values": {
//           "Petrol":   { "to": "petrol", "by": "provider" },
//           "Fuel oil": { "to": "diesel", "by": "provider", "reason": "Acme treats fuel oil as diesel (docs 4.2)" },
//           "Town gas": { "to": null, "by": "provider", "reason": "not supported" }      // no equivalent
//         }
//       }
//     },
//     "defaults": {                         // calculator inputs GEETA doesn't provide
//       "purchases[].fractionConsumed": { "value": 1, "by": "provider", "reason": "Acme assumes all of it is used" }
//     },
//     "assumptions": {                      // readings of an ambiguous definition
//       "lime FracLime": { "reading": "limestone share of the product; the rest is dolomite", "by": "proposed", "reason": "the schema doesn't say" }
//     }
//   }
//
// "by" is who decided: "provider" (final; an LLM never changes it) or "proposed" (a draft, by an LLM or a person,
// waiting for review). `geeta-compare mapping` lists the gaps and the proposals; `--check` fails while any remain.
import fs from "node:fs";
import path from "node:path";
import { calculatorEntry } from "./calculators/config";
import { inWorkspace } from "./workspace";

export type DecidedBy = "provider" | "proposed";
export type LookupEntry = { to: string | number | boolean | null; by?: DecidedBy; reason?: string };
export type LookupTable = { geeta?: string; values: Record<string, LookupEntry> };
export type DefaultEntry = { value: unknown; by?: DecidedBy; reason?: string };
export type AssumptionEntry = { reading: string; by?: DecidedBy; reason?: string };
export type MappingFile = {
  lookups?: Record<string, LookupTable>;
  defaults?: Record<string, DefaultEntry>;
  assumptions?: Record<string, AssumptionEntry>;
};

/** One decision an adapter used (or needed and didn't find) while running one scenario. */
export type DecisionUse = {
  kind: "lookup" | "default" | "assumption";
  key: string;
  /** The GEETA value looked up. */
  value?: string;
  /** What the decision gave: the calculator value, the default, the reading; undefined for a gap. */
  to?: unknown;
  by?: DecidedBy;
  reason?: string;
  gap?: boolean;
};

/** Decisions used since the last reset: the runner, docs and `mapping` command read them per scenario. */
let used: DecisionUse[] = [];
/** Notes printed since the last reset: each one once per scenario, however many rows use the decision. */
const noted = new Set<string>();
const note = (message: string) => {
  if (noted.has(message)) return;
  noted.add(message);
  console.warn(message);
};
export const resetDecisionUses = () => {
  used = [];
  noted.clear();
};
export const decisionUses = () => used;

/** Where a calculator's mapping file is: mapping.json beside its plug-in. */
export const mappingFileOf = (id: string) => inWorkspace(path.dirname(calculatorEntry(id).plugin), "mapping.json");

const cache = new Map<string, MappingFile>();
export const readMapping = (id: string): MappingFile => {
  const file = mappingFileOf(id);
  if (!cache.has(id)) cache.set(id, fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as MappingFile) : {});
  return cache.get(id)!;
};

const describe = (u: DecisionUse) => (u.reason ? ` (${u.by ?? "provider"}: ${u.reason})` : u.by === "proposed" ? " (proposed, not reviewed)" : "");

export type Mapping = {
  /**
   * The calculator value for a GEETA value. A decision of null ("no equivalent") or no decision at all returns
   * undefined and prints a note; the adapter leaves that input out.
   */
  lookup: (table: string, value: unknown) => any;
  /** A default for a calculator input GEETA doesn't provide; undefined (and a note) if none is decided. */
  default: (field: string) => any;
  /** The reading decided for an ambiguous definition; undefined (and a note) if none is decided. */
  assumption: (key: string) => string | undefined;
};

/** The mapping decisions of calculator `id` (its calculators/<id>/mapping.json), for its adapters. */
export const mapping = (id: string): Mapping => ({
  lookup: (table, value) => {
    const v = String(value);
    const entry = readMapping(id).lookups?.[table]?.values?.[v];
    if (!entry) {
      used.push({ kind: "lookup", key: table, value: v, gap: true });
      note(`No mapping decision for ${table} = "${v}" (mapping.json lookups): left out`);
      return undefined;
    }
    const u: DecisionUse = { kind: "lookup", key: table, value: v, to: entry.to, by: entry.by ?? "provider", reason: entry.reason };
    used.push(u);
    if (entry.to === null) {
      note(`${table} = "${v}": no equivalent, left out${describe(u)}`);
      return undefined;
    }
    // A plain correspondence stays quiet; a proposal or a reasoned substitution is worth a note
    if (entry.by === "proposed" || entry.reason) note(`${table} = "${v}" -> ${JSON.stringify(entry.to)}${describe(u)}`);
    return entry.to;
  },
  default: (field) => {
    const entry = readMapping(id).defaults?.[field];
    if (!entry) {
      used.push({ kind: "default", key: field, gap: true });
      note(`No default decided for ${field} (mapping.json defaults): not set`);
      return undefined;
    }
    const u: DecisionUse = { kind: "default", key: field, to: entry.value, by: entry.by ?? "provider", reason: entry.reason };
    used.push(u);
    note(`${field} = ${JSON.stringify(entry.value)}: a default, not a GEETA input${describe(u)}`);
    return entry.value;
  },
  assumption: (key) => {
    const entry = readMapping(id).assumptions?.[key];
    if (!entry) {
      used.push({ kind: "assumption", key, gap: true });
      note(`No reading decided for ${key} (mapping.json assumptions)`);
      return undefined;
    }
    const u: DecisionUse = { kind: "assumption", key, to: entry.reading, by: entry.by ?? "provider", reason: entry.reason };
    used.push(u);
    note(`Assumed for ${key}: ${entry.reading}${describe(u)}`);
    return entry.reading;
  },
});
