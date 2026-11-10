// Neutral scenario for VEERG 4.6 Manure management: poultry, and its conversion to and from the workbook's test
// fixture format. Input names are the catalogue symbols (catalogue/veerg-inputs.md, 4.6); class and system names
// are verbatim from the 4.6 subscript table in the (pre-release) chapter 4 text.
import { type Site, siteFromVeerg, siteToVeerg } from "./site";

/** Poultry class j / subclass k, as the 4.6 subscript table names them. */
export const CLASSES = {
  "1 = Layer": { veerg: "Layers" },
  "2a = Meat Chicken Growers": { veerg: "MeatChickenGrowers" },
  "2b = Meat Chicken Breeders": { veerg: "MeatChickenBreeders" },
  "2c = Other": { veerg: "Others" },
} as const;

/** Manure management system m, primary systems (T=1). */
export const PRIMARY = {
  "10 = Poultry manure with litter": { veerg: "PoultryManureWithBedding" },
  "11a = Poultry manure without litter with belt manure removal": { veerg: "BeltManureRemoval" },
  "11b = Poultry manure without litter with manure stored in house": { veerg: "ManureStoredInHouse" },
  "14 = Pasture range and paddock": { veerg: "PastureRangeAndPaddock" },
} as const;

/** Manure management system m, secondary systems (T=2). */
export const SECONDARY = {
  "4 = Solid Storage": { veerg: "SolidStorage" },
  "6 = Composting (passive windrow)": { veerg: "CompostingPassiveWindrow" },
  "7 = Digestor/Covered Lagoon": { veerg: "DigesterCoveredLagoons" },
  "12 = Direct processing into pelletized fertilizer": { veerg: "DirectProcessing" },
  "13 = Direct application to soils": { veerg: "DirectApplication" },
} as const;

export type PoultryClass = keyof typeof CLASSES;
export type PrimaryMMS = keyof typeof PRIMARY;
export type SecondaryMMS = keyof typeof SECONDARY;
/** Primary systems that pass manure on to a secondary system (all except pasture). */
export const HOUSED = (Object.keys(PRIMARY) as PrimaryMMS[]).filter((m) => m !== "14 = Pasture range and paddock");
type Housed = (typeof HOUSED)[number];
type ByClass<T> = Partial<Record<PoultryClass, T>>;
type Routes<T> = Partial<Record<Housed, Partial<Record<SecondaryMMS, T>>>>;

export interface PoultryScenario {
  section: "4.6 Poultry";
  scenario: { name: string; description?: string; notes?: unknown };
  site: Site;
  /** Methodology inputs (catalogue symbols). Fractions are 0-1. */
  inputs: {
    /** j: production system where manure is applied (4.6.1.5, 4.6.1.7, 4.6.1.12, 4.6.1.14) */
    "production system": "Pasture" | "Crop";
    /** ir: irrigation method where manure is applied */
    "irrigation method": string;
    /** number of poultry in each class and subclass (birds) */
    N_jk: ByClass<number>;
    /** duration of stay of each class and subclass (days) */
    D_jk: ByClass<number>;
    /** Method 2: dry matter intake (kg DM/bird/day); Method 1 uses Table A.1.7.1 */
    I_jk?: ByClass<number>;
    /** Method 2: dry matter digestibility (fraction) */
    DMD_jk?: ByClass<number>;
    /** Method 2: crude protein content of feed (fraction) */
    CP_jk?: ByClass<number>;
    /** fraction of manure in each primary system */
    MMS_jmT1: ByClass<Partial<Record<PrimaryMMS, number>>>;
    /** fraction of manure in each secondary system, per primary system */
    MMS_jmT2: ByClass<Routes<number>>;
    /** fraction of manure applied to soil within the farm boundary: one value, or per primary -> secondary route */
    PF: number | Routes<number>;
  };
  /** Front-end conveniences of the workbook that aren't methodology inputs (kept so conversion is lossless). */
  workbook?: {
    "farm name"?: string;
    "reporting entity name"?: string;
    /** Free range / Barn / Cage */
    "poultry production system"?: string;
    /** Where manure from each route goes; PF = "Fert for own farm" + "Direct application to soil" */
    "manure destinations"?: Routes<{ Sold: number; "Fert for own farm": number; "Direct application to soil": number }>;
  };
}

// ---------- helpers

const round = (v: number) => Number(v.toFixed(10));
/** "30%" -> 0.3, 0.3 -> 0.3, blank -> 0 */
const fraction = (v: unknown) =>
  v === undefined || v === null || v === "" ? 0 : round(typeof v === "string" ? parseFloat(v) / 100 : Number(v));
const percent = (v: number | undefined) => `${Number(((v ?? 0) * 100).toFixed(8))}%`;
const table = (input: any, name: string): Record<string, any> => {
  const merged: Record<string, any> = {};
  for (const t of input.InputTables ?? []) if (t.TableName === name) Object.assign(merged, t.Cols ?? t.Rows ?? {});
  return merged;
};
const entries = <T extends object>(o: T | undefined) => Object.entries(o ?? {}) as [Extract<keyof T, string>, NonNullable<T[keyof T]>][];
const nonZero = <K extends string>(pairs: [K, number][]) => Object.fromEntries(pairs.filter(([, v]) => v > 0)) as Partial<Record<K, number>>;

/** Stage 2 shares for one class and primary system; the workbook's "Direct application" column is the remainder. */
const stage2Shares = (row: Record<string, any>) => {
  const listed = (Object.keys(SECONDARY) as SecondaryMMS[]).filter((m) => m !== "13 = Direct application to soils");
  const shares = listed.map((m) => [m, fraction(row[SECONDARY[m].veerg])] as [SecondaryMMS, number]);
  const direct = row.DirectApplication !== undefined && row.DirectApplication !== ""
    ? fraction(row.DirectApplication)
    : round(1 - shares.reduce((s, [, v]) => s + v, 0));
  return nonZero([...shares, ["13 = Direct application to soils", direct]]);
};

// ---------- workbook fixture -> neutral

export const poultryFromVeerg = (input: any): PoultryScenario => {
  const movement = table(input, "X_Table_Poultry_Movement");
  const diet = table(input, "X_Table_Poultry_Diet_Method2");
  const stage1 = table(input, "X_Table_Poultry_Stage1MMS");
  const active = (Object.keys(CLASSES) as PoultryClass[]).filter((c) => Number(movement[CLASSES[c].veerg]?.Head) > 0);
  const byClass = <T>(f: (c: PoultryClass) => T | undefined) =>
    Object.fromEntries(active.map((c) => [c, f(c)]).filter(([, v]) => v !== undefined)) as ByClass<T>;
  const dietValue = (field: string) => (c: PoultryClass) => {
    const v = diet[CLASSES[c].veerg]?.[field];
    return v === undefined || v === "" ? undefined : Number(v);
  };

  const MMS_jmT1 = byClass((c) => nonZero((Object.keys(PRIMARY) as PrimaryMMS[]).map((m) => [m, fraction(stage1[CLASSES[c].veerg]?.[PRIMARY[m].veerg])])));
  const MMS_jmT2 = byClass((c) => {
    const routes: Routes<number> = {};
    for (const m of HOUSED)
      if ((MMS_jmT1[c]?.[m] ?? 0) > 0) routes[m] = stage2Shares(table(input, `X_Table_Poultry_Stage2MMS_${PRIMARY[m].veerg}`)[CLASSES[c].veerg] ?? {});
    return routes;
  });

  // PF and destinations for the routes manure actually takes
  const destinations: NonNullable<PoultryScenario["workbook"]>["manure destinations"] = {};
  const pf: Routes<number> = {};
  for (const m1 of HOUSED) {
    const d = table(input, `X_Table_Poultry_Stage2MMS_${PRIMARY[m1].veerg}_Destinations`);
    for (const m2 of Object.keys(SECONDARY) as SecondaryMMS[]) {
      if (!active.some((c) => (MMS_jmT2[c]?.[m1]?.[m2] ?? 0) > 0)) continue;
      const split = {
        Sold: fraction(d.Sold?.[SECONDARY[m2].veerg]),
        "Fert for own farm": fraction(d.FertOwnFarm?.[SECONDARY[m2].veerg]),
        "Direct application to soil": fraction(d.DirectApplication?.[SECONDARY[m2].veerg]),
      };
      (destinations[m1] ??= {})[m2] = split;
      (pf[m1] ??= {})[m2] = round(split["Fert for own farm"] + split["Direct application to soil"]);
    }
  }
  const pfValues = Object.values(pf).flatMap((r) => Object.values(r ?? {}));
  const PF = pfValues.length === 0 ? 1 : pfValues.every((v) => v === pfValues[0]) ? pfValues[0] : pf;

  return {
    section: "4.6 Poultry",
    scenario: {
      name: input.ScenarioName,
      ...(input.ScenarioDescription ? { description: input.ScenarioDescription } : {}),
      ...(input.ScenarioNotes ? { notes: input.ScenarioNotes } : {}),
    },
    site: siteFromVeerg(input),
    inputs: {
      "production system": input.X_Cell_Poultry_ManureAppliedProductionSystem,
      "irrigation method": input.X_Cell_Poultry_ManureAppliedIrrigationMethod ?? "Not irrigated",
      N_jk: byClass((c) => Number(movement[CLASSES[c].veerg].Head)),
      D_jk: byClass((c) => Number(movement[CLASSES[c].veerg].Duration)),
      I_jk: byClass(dietValue("DryMatterIntake")),
      DMD_jk: byClass(dietValue("DryMatterDigestibility")),
      CP_jk: byClass(dietValue("CrudeProtein")),
      MMS_jmT1,
      MMS_jmT2,
      PF,
    },
    workbook: {
      "farm name": input.X_Cell_Site_FarmName,
      "reporting entity name": input.X_Cell_Site_ReportingEntityName,
      "poultry production system": input.X_Cell_Poultry_ProductionSystem,
      "manure destinations": destinations,
    },
  };
};

// ---------- neutral -> workbook fixture

const META = { MatrixType: "ColsToRows", ColumnOffset: null, RowOffset: null };

/**
 * A standalone workbook test scenario (no ScenarioExtends). Method 1 diet values and the stage 2 "Direct
 * application" column are workbook formulas, so they're left out.
 */
export const poultryToVeerg = (s: PoultryScenario) => {
  const { inputs, workbook = {} } = s;
  const allClasses = Object.keys(CLASSES) as PoultryClass[];
  const cols = (f: (c: PoultryClass) => Record<string, unknown>) => Object.fromEntries(allClasses.map((c) => [CLASSES[c].veerg, f(c)]));
  const pfFor = (m1: Housed, m2: SecondaryMMS) => (typeof inputs.PF === "number" ? inputs.PF : (inputs.PF[m1]?.[m2] ?? 1));
  const split = (m1: Housed, m2: SecondaryMMS) => {
    const given = workbook["manure destinations"]?.[m1]?.[m2];
    if (given) return given;
    const pf = pfFor(m1, m2);
    return { Sold: round(1 - pf), "Fert for own farm": 0, "Direct application to soil": pf };
  };
  const listed = (Object.keys(SECONDARY) as SecondaryMMS[]).filter((m) => m !== "13 = Direct application to soils");
  const dietClasses = allClasses.filter((c) => [inputs.I_jk, inputs.DMD_jk, inputs.CP_jk].some((t) => t?.[c] !== undefined));

  return {
    ScenarioName: s.scenario.name,
    ...(s.scenario.description ? { ScenarioDescription: s.scenario.description } : {}),
    ...(s.scenario.notes ? { ScenarioNotes: s.scenario.notes } : {}),
    X_Cell_Site_FarmName: workbook["farm name"] ?? "",
    X_Cell_Site_ReportingEntityName: workbook["reporting entity name"] ?? "",
    ...siteToVeerg(s.site),
    X_Cell_Poultry_ProductionSystem: workbook["poultry production system"] ?? "",
    X_Cell_Poultry_ManureAppliedProductionSystem: inputs["production system"],
    X_Cell_Poultry_ManureAppliedIrrigationMethod: inputs["irrigation method"],
    InputTables: [
      { TableName: "X_Table_Poultry_Movement", ...META, Cols: cols((c) => ({ Duration: inputs.D_jk[c] ?? 0, Head: inputs.N_jk[c] ?? 0 })) },
      ...(dietClasses.length
        ? [{
            TableName: "X_Table_Poultry_Diet_Method2",
            ...META,
            Cols: Object.fromEntries(dietClasses.map((c) => [CLASSES[c].veerg, {
              ...(inputs.I_jk?.[c] !== undefined ? { DryMatterIntake: inputs.I_jk[c] } : {}),
              ...(inputs.DMD_jk?.[c] !== undefined ? { DryMatterDigestibility: inputs.DMD_jk[c] } : {}),
              ...(inputs.CP_jk?.[c] !== undefined ? { CrudeProtein: inputs.CP_jk[c] } : {}),
            }])),
          }]
        : []),
      {
        TableName: "X_Table_Poultry_Stage1MMS",
        ...META,
        Cols: cols((c) => Object.fromEntries(entries(PRIMARY).map(([m, { veerg }]) => [veerg, percent(inputs.MMS_jmT1[c]?.[m])]))),
      },
      ...HOUSED.map((m1) => ({
        TableName: `X_Table_Poultry_Stage2MMS_${PRIMARY[m1].veerg}`,
        ...META,
        Cols: cols((c) => Object.fromEntries(listed.map((m2) => [SECONDARY[m2].veerg, percent(inputs.MMS_jmT2[c]?.[m1]?.[m2])]))),
      })),
      ...HOUSED.map((m1) => ({
        TableName: `X_Table_Poultry_Stage2MMS_${PRIMARY[m1].veerg}_Destinations`,
        ...META,
        Cols: Object.fromEntries(
          ([["Sold", "Sold"], ["FertOwnFarm", "Fert for own farm"], ["DirectApplication", "Direct application to soil"]] as const).map(
            ([row, key]) => [row, Object.fromEntries(entries(SECONDARY).map(([m2, { veerg }]) => [veerg, percent(split(m1, m2)[key])]))],
          ),
        ),
      })),
    ],
  };
};
