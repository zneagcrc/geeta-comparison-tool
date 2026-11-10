// Every module with a neutral format: how to convert its fixtures. Each calculator calculates VEERG results from a
// neutral scenario itself (Calculator.neutralResults).
import { type ModuleSpec, fromVeerg, toVeerg } from "./engine";
import { ELECTRICITY, FUEL, REFRIGERANTS, SUPPLEMENTARY_CO2, WASTEWATER, WASTE_SOLID } from "./modules/batch1";
import { AG_RESIDUE, FERTILISER, RICE } from "./modules/batch2";
import { ENTERIC_FEEDLOT, ENTERIC_PIGS, MANURE_FEEDLOT, MANURE_PIGS } from "./modules/livestock";
import { ENTERIC_DAIRY, MANURE_DAIRY } from "./modules/livestock";
import { ENTERIC_BEEF, ENTERIC_SHEEP, MANURE_BEEF, MANURE_SHEEP } from "./modules/livestock";
import { PRIMARY, SECONDARY, poultryFromVeerg, poultryToVeerg } from "./poultry";
import { enterpriseFromVeerg, enterpriseToVeerg } from "./enterprise";
import { SCOPE3 } from "./modules/scope3";

export type NeutralModule = {
  test: string;
  /** The neutral files' `section`, e.g. "8 Fuel use". */
  section: string;
  /** Folder under scenarios/ for exported neutral files. */
  folder: string;
  fromVeerg: (input: any) => any;
  toVeerg: (s: any) => any;
  /** Fixture fields the generator doesn't reproduce and that can't affect results (formula cells, unused rows, ...). */
  ignore?: (field: string, input: any, neutral: any) => boolean;
};

const fromSpec = (spec: ModuleSpec, folder: string): NeutralModule => ({
  test: spec.test,
  section: spec.section,
  folder,
  fromVeerg: (input) => fromVeerg(spec, input),
  toVeerg: (s) => toVeerg(spec, s),
});

const poultry: NeutralModule = {
  test: "ManureManagement.Poultry",
  section: "4.6 Poultry",
  folder: "4.6-poultry",
  fromVeerg: poultryFromVeerg,
  toVeerg: poultryToVeerg,
  ignore: (f, input, neutral) => {
    const [tableName, col, field] = f.split(".");
    if (tableName === "X_Table_Poultry_Diet_Method1") return true;
    if (/^X_Table_Poultry_Stage2MMS_[A-Za-z]+$/.test(tableName ?? "") && field === "DirectApplication") return true;
    const movement = input.InputTables.find((t: any) => t.TableName === "X_Table_Poultry_Movement")?.Cols ?? {};
    const inactive = new Set(Object.keys(movement).filter((c) => !(Number(movement[c]?.Head) > 0)));
    if (/^X_Table_Poultry_(Movement|Diet_Method2|Stage1MMS|Stage2MMS_[A-Za-z]+)$/.test(tableName ?? "") && inactive.has(col)) return true;
    const m1 = tableName?.match(/^X_Table_Poultry_Stage2MMS_([A-Za-z]+)$/)?.[1];
    const usesPrimary = (c: string, m: string) =>
      Number.parseFloat(input.InputTables.find((t: any) => t.TableName === "X_Table_Poultry_Stage1MMS")?.Cols?.[c]?.[m] ?? "0") > 0;
    if (m1 && !usesPrimary(col, m1)) return true;
    const route = tableName?.match(/^X_Table_Poultry_Stage2MMS_([A-Za-z]+)_Destinations$/)?.[1];
    const usedRoutes = new Set(
      Object.entries(neutral.workbook?.["manure destinations"] ?? {}).flatMap(([p, row]) =>
        Object.keys(row ?? {}).map((s) => `${PRIMARY[p as keyof typeof PRIMARY].veerg}.${SECONDARY[s as keyof typeof SECONDARY].veerg}`),
      ),
    );
    if (route && !usedRoutes.has(`${route}.${field}`)) return true;
    return false;
  },
};

export const MODULES: NeutralModule[] = [
  fromSpec(ENTERIC_FEEDLOT, "3.1-enteric-feedlot"),
  fromSpec(ENTERIC_BEEF, "3.2-enteric-beef"),
  fromSpec(ENTERIC_DAIRY, "3.3-enteric-dairy"),
  fromSpec(ENTERIC_SHEEP, "3.4-enteric-sheep"),
  fromSpec(ENTERIC_PIGS, "3.5-enteric-pigs"),
  fromSpec(MANURE_FEEDLOT, "4.1-manure-feedlot"),
  fromSpec(MANURE_BEEF, "4.2-manure-beef"),
  fromSpec(MANURE_DAIRY, "4.3-manure-dairy"),
  fromSpec(MANURE_SHEEP, "4.4-manure-sheep"),
  fromSpec(MANURE_PIGS, "4.5-manure-pigs"),
  fromSpec(FERTILISER, "5-fertiliser"),
  fromSpec(AG_RESIDUE, "6-residues"),
  fromSpec(RICE, "7-rice"),
  fromSpec(FUEL, "8-fuel"),
  fromSpec(REFRIGERANTS, "9-refrigerants"),
  fromSpec(WASTE_SOLID, "10-solid-waste"),
  fromSpec(WASTEWATER, "11-wastewater"),
  fromSpec(SUPPLEMENTARY_CO2, "12-supplementary-co2"),
  fromSpec(ELECTRICITY, "14-electricity"),
  fromSpec(SCOPE3, "15-scope3"),
  poultry,
  ...(
    [
      ["PastureBeef", "Pasture beef"],
      ["Dairy", "Dairy"],
      ["Sheep", "Sheep"],
      ["Feedlot", "Beef feedlot"],
      ["Pigs", "Pigs"],
      ["Poultry", "Poultry"],
      ["CroppingGrains", "Grains"],
      ["CroppingCotton", "Cotton"],
      ["EnvironmentalPlantings", "Environmental plantings"],
    ] as const
  ).map(([name, label]): NeutralModule => ({
    test: `Enterprises.${name}`,
    section: `Enterprise: ${label}`,
    folder: `enterprise-${name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`,
    fromVeerg: enterpriseFromVeerg(`Enterprise: ${label}`),
    toVeerg: enterpriseToVeerg,
  })),
];

export const moduleFor = (test: string) => MODULES.find((m) => m.test === test);
/** The module a neutral file belongs to, by its section. */
export const moduleForScenario = (s: { section: string }) => MODULES.find((m) => m.section === s.section);
