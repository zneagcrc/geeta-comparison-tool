// Neutral spec for the Scope 3 test (chapter 15, with the chapter 8 fuel and chapter 14 electricity it draws on):
// purchased livestock (15.1), feed (15.2), mineral supplements (15.3), fertiliser (15.4), agrichemicals (15.5), lime and
// soil ameliorants (15.6), services (15.7), packaging (15.8), other purchases (15.9), solid waste (15.12) and freight
// (15.13). Names: catalogue symbols where the input goes straight into an equation (Q_j, Q_m, N_co, W_co, Q_wf, V_wf),
// otherwise the chapter's wording; products, livestock types and waste types as the workbook lists them (the Appendix A
// tables A.3.1.1 and A.3.2.1, and the Scope 3 source data). Source document: pre-release accepted chapters 14-15.
import { type ModuleSpec, type RowTableSpec, SITE_CELLS } from "../engine";
import { FERTILISER } from "./batch2";
import { ELECTRICITY } from "./batch1";

const ROWS = { MatrixType: "RowsToCols", ColumnOffset: 0, RowOffset: null };

const fertiliserTable = (name: string, overrides: Partial<RowTableSpec> = {}) => {
  const t = FERTILISER.tables.find((x) => x.table === name);
  if (!t || t.kind !== "rows") throw new Error(`No fertiliser table ${name}`);
  return { ...t, props: ROWS, ...overrides } as RowTableSpec;
};

/** Q_j by product: the workbook's feed ration and fish feed cells (kg purchased). */
const FEED_CELLS = {
  X_Cell_FarmInputs_FeedRations_Chickens: "Feed for chickens",
  X_Cell_FarmInputs_FeedRations_DairyCalves: "Feed for dairy calves",
  X_Cell_FarmInputs_FeedRations_DairyCows: "Feed for dairy cows",
  X_Cell_FarmInputs_FeedRations_Pigs: "Feed for pigs",
  X_Cell_Input_AquacultureInput_SardinesSouthAustralia: "Sardines (whole) from South Australia",
  X_Cell_Input_AquacultureInput_SardinesAustralia: "Sardines (whole) from the rest of Australia",
  X_Cell_Input_AquacultureInput_LowAnimalProteinFormulatedFeed: "Low Animal Protein Formulated Feed",
  X_Cell_Input_AquacultureInput_Squid: "Squid",
  X_Cell_Input_AquacultureInput_WholeFish: "Whole fish",
  X_Cell_Input_AquacultureInput_CustomBait: "Custom Bait",
};

const blendFields = [1, 2, 3, 4, 5, 6].flatMap((i) => [
  { field: `Ingredient${i}`, key: `ingredient ${i}` },
  { field: `Ingredient${i}SourceRegion`, key: `ingredient ${i} region of origin` },
  { field: `Ingredient${i}Percent`, key: `ingredient ${i} fraction of blend`, percent: true },
]);

/** Q_m by mineral supplement type m (15.3, kg). */
const SUPPLEMENT_CELLS = {
  X_Cell_FarmInputs_LickBlocks_DrySeasonMix: "Lick block, dry season mix",
  X_Cell_FarmInputs_LickBlocks_Mineral: "Lick block, mineral",
  X_Cell_FarmInputs_LickBlocks_Weaner: "Lick block, weaner",
};

/** Other purchased goods (15.9) by product, as the workbook's source data names them. */
const OTHER_CELLS = {
  X_Cell_FarmInputs_Seed_BarleyGrain: "Barley grain (for seed)",
  X_Cell_FarmInputs_Seed_MaizeGrain: "Maize grain (for seed)",
  X_Cell_FarmInputs_Seed_OatGrain: "Oat grain (for seed)",
  X_Cell_FarmInputs_Seed_SorghumGrain: "Sorghum grain (for seed)",
  X_Cell_FarmInputs_Seed_WheatGrain: "Wheat grain (for seed)",
  X_Cell_FarmInputs_Misc_AnimalEarTagsLarge: "Animal ear tags (large)",
  X_Cell_FarmInputs_Misc_AnimalEarTagsSmall: "Animal ear tags (small)",
  X_Cell_FarmInputs_Misc_NylonNetting: "Nylon netting",
};

const rows = (table: string, key: string, fields: RowTableSpec["fields"], place: RowTableSpec["place"] = "inputs"): RowTableSpec => ({
  kind: "rows",
  table,
  place,
  key,
  rowPrefix: "Row",
  props: ROWS,
  fields,
});

const CALC = "(calculated by the workbook)";

/** Fuel tables (chapter 8 and, for contractors, 15.7): the Fuel test's wording. */
const fuelFields = (consumedUnit: boolean) => [
  { field: "FuelUse", key: "use (transport type or stationary combustion)" },
  { field: "FuelType", key: "fuel type q" },
  { field: "AmountPurchased", key: "amount purchased" },
  { field: "AmountUnit", key: "unit" },
  { field: "PercentConsumed", key: "fraction consumed in the reporting period", percent: true },
  { field: "AmountConsumed", key: `amount consumed ${CALC}`, place: "workbook" as const },
  ...(consumedUnit ? [{ field: "AmountConsumedUnit", key: `amount consumed unit ${CALC}`, place: "workbook" as const }] : []),
];

/** Livestock purchases (15.1): N_co head, W_co by method; the class / origin columns each type has. */
const purchaseFields = (extra: RowTableSpec["fields"]) => [
  { field: "TransactionName", key: "transaction description" },
  ...extra,
  { field: "Quantity", key: "N_co (head)" },
  { field: "LiveweightMethod1", key: `W_co (Method 1, kg/head) ${CALC}`, place: "workbook" as const },
  { field: "LiveweightMethod2", key: "W_co (Method 2, kg/head)" },
];

const freightFields = [
  { field: "RouteName", key: "route" },
  { field: "FreightType", key: "freight type f" },
  { field: "RouteDistance", key: "route distance (km)" },
  { field: "AverageWeightOfFreightPerTrip", key: "W_f per trip (t)" },
  { field: "NumberOfTripsTaken", key: "number of trips" },
];

const freightFuelFields = [
  { field: "FuelType", key: "fuel type q" },
  { field: "AmountConsumed", key: "amount consumed (kL)" },
];

const pesticideFields = [
  { field: "ProductName", key: "product name" },
  { field: "AmountAppliedPerHa", key: "amount applied per hectare" },
  { field: "ApplicationUnit", key: "application unit" },
  { field: "ApplicationArea", key: "application area (ha)" },
  { field: "TotalApplied", key: `total applied ${CALC}`, place: "workbook" as const },
  { field: "ConstituentUnit", key: "active ingredient unit" },
  ...[1, 2, 3].flatMap((i) => [
    { field: `ActiveIngredient${i}`, key: `active ingredient ${i} (agrichemical type h)` },
    { field: `ActiveIngredient${i}Amount`, key: `active ingredient ${i} amount` },
    { field: `TotalActiveIngredient${i}`, key: `total active ingredient ${i} (kg) ${CALC}`, place: "workbook" as const },
  ]),
];

/** The Scope 3 fixture writes the REC tables with positional columns. */
const REC_COLS = [
  { field: "Col1", key: "description" },
  { field: "Col2", key: "source" },
  { field: "Col3", key: "generation date" },
  { field: "Col4", key: "number of certificates" },
  { field: "Col5", key: "MWh" },
  { field: "Col6", key: "eligibility" },
];

export const SCOPE3: ModuleSpec = {
  test: "Scope3",
  section: "15 Scope 3",
  cells: [
    ...SITE_CELLS,
    ...FERTILISER.cells.filter((c) => c.cell.startsWith("X_Cell_Fertiliser_")),
    ...Object.entries(FEED_CELLS).map(([cell, product]) => ({ cell, place: "inputs" as const, key: ["Q_j (kg)", product] })),
    ...Object.entries(SUPPLEMENT_CELLS).map(([cell, type]) => ({ cell, place: "inputs" as const, key: ["Q_m (kg)", type] })),
    ...Object.entries(OTHER_CELLS).map(([cell, product]) => ({ cell, place: "inputs" as const, key: ["other purchased goods (quantity)", product] })),
    { cell: "X_Cell_Fuel_IsMetroLocation", place: "inputs", key: "metro or non-metro location" },
    { cell: "X_Cell_Fuel_IsMetroLocation_Contractors", place: "inputs", key: "metro or non-metro location (contractors)" },
    // Scope 2 / 15.11 electricity: the Electricity test's wording
    ...ELECTRICITY.cells.filter((c) => c.cell.startsWith("X_Cell_Electricity_")),
  ],
  tables: [
    fertiliserTable("Table_Input_InorganicFertiliser_Brands"),
    fertiliserTable("Table_Input_InorganicFertiliser_Custom"),
    fertiliserTable("Table_Input_Lime"),
    // This fixture names the organic fertiliser rows "Lime1", "Lime2", ... (the fertiliser fixtures use "Application")
    fertiliserTable("Table_Input_OrganicFertiliser", { rowPrefix: "Lime" }),
    {
      kind: "rows",
      table: "Table_Input_UnmanagedWaste_Offsite",
      place: "inputs",
      // Q_wf (tonnes) or V_wf (m3) by treatment facility f and waste type w
      key: "solid waste sent to treatment facilities",
      rowPrefix: "Waste",
      props: ROWS,
      fields: [
        { field: "Description", key: "description" },
        { field: "DisposalMethod", key: "treatment facility type f" },
        { field: "WasteType", key: "waste type w" },
        { field: "Amount", key: "amount" },
        { field: "AmountUnit", key: "unit" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_FeedBlends",
      place: "inputs",
      // Q_j per ingredient = amount fed x the ingredient's fraction of the blend
      key: "feed blends purchased",
      rowPrefix: "Blend",
      props: ROWS,
      fields: [{ field: "FeedBlendName", key: "name" }, { field: "AmountFed", key: "amount fed (kg)" }, ...blendFields],
    },
    // Chapter 8 fuel (scope 1 and its 15.10 upstream emissions) and contractors' fuel (15.7)
    rows("Table_Input_Fuel", "fuel purchased", fuelFields(true)),
    rows("Table_Input_Fuel_Contractors", "fuel used by contractors (15.7)", fuelFields(true)),
    // 15.1 purchased livestock
    rows(
      "Table_Input_LivestockPurchases_Beefcattle",
      "beef cattle purchased",
      purchaseFields([
        { field: "PurchaseDate", key: "purchase date" },
        { field: "Class", key: "class" },
        { field: "PurchaseClass", key: "livestock type c" },
        { field: "SourceRegion", key: "origin o" },
      ]),
    ),
    rows(
      "Table_Input_LivestockPurchases_Dairy",
      "dairy cattle purchased",
      purchaseFields([
        { field: "Class", key: "class" },
        { field: "Breed", key: "breed" },
      ]),
    ),
    rows(
      "Table_Input_LivestockPurchases_Sheep",
      "sheep purchased",
      purchaseFields([
        { field: "PurchaseDate", key: "purchase date" },
        { field: "Class", key: "class" },
        { field: "PurchaseClass", key: "livestock type c" },
        { field: "SourceRegion", key: "origin o" },
      ]),
    ),
    rows("Table_Input_LivestockPurchases_Pigs", "pigs purchased", purchaseFields([{ field: "Class", key: "class" }])),
    rows("Table_Input_LivestockPurchases_Poultry", "poultry purchased", purchaseFields([{ field: "Class", key: "class" }])),
    rows("Table_Input_LivestockPurchases_OtherLivestock", "other livestock purchased", purchaseFields([{ field: "Class", key: "livestock type c" }])),
    // 15.5 agrichemicals: Q_h is the active ingredient applied
    rows("Table_Input_Pesticides", "agrichemicals applied", pesticideFields),
    // 15.8 packaging: Q_p = units x weight per unit
    rows("Table_Input_Packaging", "packaging purchased", [
      { field: "PackagingName", key: "description" },
      { field: "QuantityPurchased", key: "quantity purchased (units)" },
      { field: "PrimaryMaterial", key: "packaging type p" },
      { field: "WeightPerUnit", key: "weight per unit (kg)" },
      { field: "TotalWeightPurchased", key: `Q_p (kg) ${CALC}`, place: "workbook" },
    ]),
    // 15.9 other purchased goods and services
    rows("Table_Input_ChemicalsCleaning", "cleaning chemicals purchased", [
      { field: "ProductName", key: "product name" },
      { field: "Type", key: "type" },
      { field: "QuantityPurchased", key: "quantity purchased (kg)" },
    ]),
    rows("Table_Input_ChemicalsPharmacy", "pharmacy chemicals purchased", [
      { field: "ProductName", key: "product name" },
      { field: "Type", key: "type" },
      { field: "NumberOfHeadTreated", key: "number of head treated" },
    ]),
    rows("Table_Input_UncategorisedProductsServices", "uncategorised products and services", [
      { field: "ProductServiceName", key: "product or service" },
      { field: "Amount", key: "amount" },
      { field: "AmountUnit", key: "unit" },
    ]),
    rows("Table_Input_GrowMedia", "grow media purchased", [
      { field: "GrowMediaType", key: "type" },
      { field: "TotalAmount", key: "amount" },
      { field: "AmountUnit", key: "unit" },
    ]),
    // 15.13 upstream freight (the workbook names its results 15_14)
    rows("Table_Input_FreightIncoming", "incoming freight", freightFields),
    rows("Table_Input_FreightOutgoing", "outgoing freight", freightFields),
    // 15.13 Method 2: fuel used by the freight carrier (no use column or unit; the workbook takes kL)
    rows("Table_Input_Fuel_FreightIncoming", "fuel used for incoming freight", freightFuelFields),
    rows("Table_Input_Fuel_FreightOutgoing", "fuel used for outgoing freight", freightFuelFields),
    // Scope 2 / 15.11 electricity certificates
    rows("Table_Input_RECSurrendered", "RECs voluntarily surrendered", REC_COLS),
    rows("Table_Input_RECConsumedByEntity", "RECs issued for electricity produced on-site and consumed", REC_COLS),
  ],
};
