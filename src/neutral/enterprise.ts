// Enterprise neutral scenarios: an enterprise fixture holds every module's inputs for one farm, so its neutral scenario
// is made of the module neutral formats, one part per module (by the module's section). Each fixture field belongs to
// exactly one part: the parts are read in order, and each reads only the fields the parts before it didn't claim (the
// fields its toVeerg writes back). What no module format covers (enterprise-only cells, e.g. lick blocks, purchased
// livestock) is kept as it is in the workbook, under `workbook`, until a module format covers it.
import { type ModuleSpec, type NeutralScenario, fromVeerg as specFromVeerg, toVeerg as specToVeerg } from "./engine";
import { ELECTRICITY, FUEL, REFRIGERANTS, SUPPLEMENTARY_CO2, WASTEWATER, WASTE_SOLID } from "./modules/batch1";
import { AG_RESIDUE, FERTILISER, RICE } from "./modules/batch2";
import {
  ENTERIC_BEEF,
  ENTERIC_DAIRY,
  ENTERIC_FEEDLOT,
  ENTERIC_PIGS,
  ENTERIC_SHEEP,
  MANURE_BEEF,
  MANURE_DAIRY,
  MANURE_FEEDLOT,
  MANURE_PIGS,
  MANURE_SHEEP,
} from "./modules/livestock";
import { SCOPE3 } from "./modules/scope3";
import { LULUCF } from "./modules/lulucf";
import { ENTERPRISE_PRODUCTION } from "./modules/enterprise-production";
import { DATA_QUALITY } from "./modules/data-quality";
import { poultryFromVeerg, poultryToVeerg } from "./poultry";

type Part = { section: string; from: (input: any) => any; to: (n: any) => any };

const spec = (s: ModuleSpec): Part => ({ section: s.section, from: (i) => specFromVeerg(s, i, { lenient: true }), to: (n) => specToVeerg(s, n) });

/** In claiming order: livestock (manure before enteric: same cells, so the manure part holds them), then the rest. */
const PARTS: Part[] = [
  ...[MANURE_BEEF, ENTERIC_BEEF, MANURE_DAIRY, ENTERIC_DAIRY, MANURE_SHEEP, ENTERIC_SHEEP, MANURE_FEEDLOT, ENTERIC_FEEDLOT, MANURE_PIGS, ENTERIC_PIGS].map(spec),
  { section: "4.6 Poultry", from: poultryFromVeerg, to: poultryToVeerg },
  ...[FERTILISER, AG_RESIDUE, RICE, FUEL, ELECTRICITY, REFRIGERANTS, WASTE_SOLID, WASTEWATER, SUPPLEMENTARY_CO2, SCOPE3, LULUCF, ENTERPRISE_PRODUCTION, DATA_QUALITY].map(spec),
];

const META = new Set(["ScenarioName", "ScenarioDescription", "ScenarioNotes", "ScenarioExtends", "FollowOnTests", "__FormulaOverwritePolicy", "InputTables", "NIRResults"]);

/** Every input field of a fixture: "cell" or "Table\u0000container\u0000member\u0000field". */
const fieldsOf = (fixture: any) => {
  const out = new Set<string>();
  for (const k of Object.keys(fixture ?? {})) if (!META.has(k)) out.add(k);
  for (const t of fixture?.InputTables ?? [])
    for (const container of ["Cols", "Rows"])
      for (const [member, fields] of Object.entries<any>(t[container] ?? {}))
        for (const f of Object.keys(fields ?? {})) out.add([t.TableName, container, member, f].join("\u0000"));
  return out;
};

/** The fixture without the claimed fields (tables keep their other fields and properties). */
const without = (fixture: any, claimed: Set<string>) => {
  const out: any = {};
  for (const [k, v] of Object.entries(fixture)) if (k !== "InputTables" && !claimed.has(k)) out[k] = v;
  out.InputTables = [];
  for (const t of fixture.InputTables ?? []) {
    const copy: any = { ...t };
    let any = false;
    for (const container of ["Cols", "Rows"]) {
      if (!t[container]) continue;
      copy[container] = {};
      for (const [member, fields] of Object.entries<any>(t[container])) {
        const kept = Object.fromEntries(Object.entries(fields ?? {}).filter(([f]) => !claimed.has([t.TableName, container, member, f].join("\u0000"))));
        if (Object.keys(kept).length) {
          copy[container][member] = kept;
          any = true;
        }
      }
    }
    if (any) out.InputTables.push(copy);
  }
  return out;
};

/**
 * Tables of values the workbook calculates, which the poultry format leaves out on purpose (src/neutral/poultry.ts:
 * Method 1 diet values and the stage 2 "Direct application" column are workbook formulas). An enterprise fixture
 * holds their values; they're kept as calculated values, not as inputs no format covers yet.
 */
const FORMULA_TABLES = /^X_Table_Poultry_(Diet_Method1|Stage2MMS_[A-Za-z]+)$/;

/** Site inputs every module format keeps under `workbook`. */
const SITE_WORKBOOK = ["farm name", "reporting entity name"];

/** The site's cells as a fixture (every module spec has the site cells; the first part's spec writes them). */
const siteFixture = (site: unknown, workbook: Record<string, unknown> = {}) =>
  PARTS[0].to({ section: "", scenario: {}, site: site ?? {}, inputs: {}, workbook });

export type EnterpriseScenario = {
  section: string;
  scenario: NeutralScenario["scenario"];
  site?: NeutralScenario["site"];
  /** Module parts by section, each without its site (the enterprise's site is shared). */
  modules: Record<string, any>;
  /**
   * The farm and entity names, and the fixture inputs no module format covers, as the workbook has them: `cells` by name,
   * `tables` by table name ({ Cols or Rows: { member: { field: value } } }), and `tableLayout`, each table's workbook
   * properties (offsets, matrix type), which aren't inputs. `calculated`: tables of values the workbook calculates, which
   * a module format leaves out on purpose (FORMULA_TABLES), in the same form as `tables`.
   */
  workbook?: Record<string, any> & {
    cells?: Record<string, unknown>;
    tables?: Record<string, any>;
    calculated?: Record<string, any>;
    tableLayout?: Record<string, any>;
  };
};

export const enterpriseFromVeerg = (section: string) => (input: any): EnterpriseScenario => {
  // The site (and the farm and entity names every module format keeps) belongs to the enterprise, not to a part
  let site: any;
  let siteWorkbook: Record<string, unknown> = {};
  for (const p of PARTS) {
    try {
      const n = p.from(input);
      site ??= n?.site;
      for (const k of SITE_WORKBOOK) if (n?.workbook?.[k] !== undefined) siteWorkbook[k] ??= n.workbook[k];
    } catch {
      // not this part's fixture
    }
  }
  // Empty cells aren't inputs (the module formats leave them out too): without them, no part reads rows of nothing that
  // another part's fields left behind
  let remaining = without(withoutEmpty(input), fieldsOf(siteFixture(site, siteWorkbook)));
  const modules: Record<string, any> = {};
  for (const p of PARTS) {
    let n: any;
    try {
      n = p.from(remaining);
    } catch {
      continue;
    }
    // A part is kept only when it claims a field the fixture has (a format writes its defaults back too)
    const have = fieldsOf(remaining);
    let written: Set<string>;
    try {
      written = fieldsOf(p.to({ ...n, site: {} }));
    } catch {
      continue;
    }
    const claimed = new Set([...written].filter((f) => have.has(f)));
    if (!claimed.size) continue;
    const { section: _s, scenario: _sc, site: _site, ...rest } = n;
    if (rest.workbook) {
      for (const k of SITE_WORKBOOK) delete rest.workbook[k];
      if (!Object.keys(rest.workbook).length) delete rest.workbook;
    }
    modules[p.section] = rest;
    remaining = without(remaining, claimed);
  }
  const cells = Object.fromEntries(Object.entries(remaining).filter(([k]) => !META.has(k)));
  const tables: Record<string, any> = {};
  const calculated: Record<string, any> = {};
  const tableLayout: Record<string, any> = {};
  for (const t of mergeTables(remaining.InputTables)) {
    const { TableName, Cols, Rows, ...layout } = t;
    const members = Object.fromEntries(
      Object.entries<any>(Cols ?? Rows)
        .filter(([, fields]) => Object.keys(fields ?? {}).length),
    );
    if (!Object.keys(members).length) continue;
    (FORMULA_TABLES.test(TableName) ? calculated : tables)[TableName] = Cols ? { Cols: members } : { Rows: members };
    if (Object.keys(layout).length) tableLayout[TableName] = layout;
  }
  const has = (o: object) => Object.keys(o).length > 0;
  return {
    section,
    scenario: { name: input.ScenarioName ?? null },
    ...(site ? { site } : {}),
    modules,
    ...(has(siteWorkbook) || has(cells) || has(tables) || has(calculated)
      ? {
          workbook: {
            ...siteWorkbook,
            ...(has(cells) ? { cells } : {}),
            ...(has(tables) ? { tables } : {}),
            ...(has(calculated) ? { calculated } : {}),
            ...(has(tableLayout) ? { tableLayout } : {}),
          },
        }
      : {}),
  };
};

const isEmpty = (v: unknown) => v === null || v === undefined || v === "";

/** The fixture without empty cells and table fields. */
const withoutEmpty = (fixture: any) => {
  const empties = new Set<string>();
  for (const [k, v] of Object.entries(fixture)) if (!META.has(k) && isEmpty(v)) empties.add(k);
  for (const t of fixture.InputTables ?? [])
    for (const container of ["Cols", "Rows"])
      for (const [member, fields] of Object.entries<any>(t[container] ?? {}))
        for (const [f, v] of Object.entries(fields ?? {})) if (isEmpty(v)) empties.add([t.TableName, container, member, f].join(" "));
  return without(fixture, empties);
};

/** Merges fixture tables of the same name (the parts and the leftovers write different fields of a table). */
const mergeTables = (tables: any[]) => {
  const byName = new Map<string, any>();
  for (const t of tables) {
    const m = byName.get(t.TableName);
    if (!m) {
      byName.set(t.TableName, structuredClone(t));
      continue;
    }
    for (const container of ["Cols", "Rows"])
      for (const [member, fields] of Object.entries<any>(t[container] ?? {})) {
        m[container] ??= {};
        m[container][member] = { ...(m[container][member] ?? {}), ...fields };
      }
    // Layout properties (Replace, offsets) the first block didn't have
    for (const [k, v] of Object.entries(t)) if (k !== "Cols" && k !== "Rows" && !(k in m)) m[k] = v;
  }
  return [...byName.values()];
};

export const enterpriseToVeerg = (s: EnterpriseScenario): any => {
  const out: any = { ScenarioName: s.scenario?.name };
  const tables: any[] = [];
  for (const p of PARTS) {
    const part = s.modules[p.section];
    if (!part) continue;
    const { InputTables, ...cells } = p.to({ section: p.section, scenario: s.scenario, site: s.site, ...part });
    Object.assign(out, cells);
    tables.push(...(InputTables ?? []));
  }
  const siteWorkbook = Object.fromEntries(SITE_WORKBOOK.filter((k) => s.workbook?.[k] !== undefined).map((k) => [k, s.workbook![k]]));
  const { InputTables: _t, ScenarioName: _n, ...siteCells } = siteFixture(s.site, siteWorkbook);
  Object.assign(out, siteCells);
  Object.assign(out, s.workbook?.cells ?? {});
  out.ScenarioName = s.scenario?.name;
  const leftover = Object.entries({ ...(s.workbook?.tables ?? {}), ...(s.workbook?.calculated ?? {}) }).map(([TableName, t]) => ({ TableName, ...(s.workbook?.tableLayout?.[TableName] ?? {}), ...t }));
  out.InputTables = mergeTables([...tables, ...leftover]);
  return out;
};
