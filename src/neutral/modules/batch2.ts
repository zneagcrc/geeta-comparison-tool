// Neutral specs for chapters 5-7 (fertiliser and lime, crop and pasture residues, rice cultivation). Names: catalogue
// symbols where the input goes straight into an equation, otherwise the chapter's wording; dimension members as
// Appendix A's tables write them. Source documents: pre-release accepted chapters 5-7 (14 Oct 2026) and Appendix A.
// Columns the workbook calculates are carried (so conversion stays lossless) and marked "(calculated by the workbook)".
import { type FieldSpec, type ModuleSpec, SITE_CELLS } from "../engine";

const ROWS = { MatrixType: "RowsToCols", ColumnOffset: 0, RowOffset: null };
const FERT_ROWS = { SheetGrouping: "Fertiliser", ...ROWS };
const CALC = " (calculated by the workbook)";

const ingredients: FieldSpec[] = [1, 2, 3, 4, 5, 6].flatMap((i) => [
  { field: `Ingredient${i}`, key: `ingredient ${i}` },
  { field: `Ingredient${i}Fraction`, key: `ingredient ${i} fraction of product`, percent: true },
]);

const inorganicCommon: FieldSpec[] = [
  { field: "ProductName", key: "product name" },
  // TM_jf for 15.4 where it differs from the amount applied (added to the workbook 2026-10-16; empty in the fixtures)
  { field: "AmountPurchased", key: "amount purchased (kg)" },
  { field: "AmountAppliedPerHectare", key: "application rate (per ha)" },
  { field: "ApplicationArea", key: "area applied (ha)" },
  { field: "TotalAmountApplied", key: `total amount applied${CALC}` },
  ...ingredients,
  { field: "NApplicationRate", key: `N application rate (kg N/ha)${CALC}` },
  { field: "UreaSourced", key: "urea sourced" },
  { field: "AmmoniaSource", key: "ammonia source" },
];

export const FERTILISER: ModuleSpec = {
  test: "Fertiliser",
  section: "5 Fertiliser and lime",
  cells: [
    ...SITE_CELLS,
    { cell: "X_Cell_Fertiliser_ProductionSystem", place: "inputs", key: "production system j" },
    { cell: "X_Cell_Fertiliser_CropType", place: "inputs", key: "crop type c" },
    { cell: "X_Cell_Fertiliser_IrrigationMethod", place: "inputs", key: "irrigation method ir" },
    { cell: "X_Cell_Fertiliser_AreaUnderCropping", place: "inputs", key: "area under cropping (ha)" },
  ],
  tables: [
    {
      // TM_jf: product mass x ingredient fraction, per fertiliser type f
      kind: "rows",
      table: "Table_Input_InorganicFertiliser_Brands",
      place: "inputs",
      key: "inorganic fertiliser products applied",
      rowPrefix: "Application",
      props: FERT_ROWS,
      fields: [
        ...inorganicCommon,
        { field: "ApplicationUnit", key: "unit" },
        { field: "Density", key: "density (kg/L)" },
        { field: "PercentNIngredients", key: `N fraction from ingredients${CALC}` },
        { field: "PercentNDeclared", key: "N fraction declared" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_InorganicFertiliser_Custom",
      place: "inputs",
      key: "custom inorganic fertiliser blends applied",
      rowPrefix: "Application",
      props: FERT_ROWS,
      fields: inorganicCommon,
    },
    {
      // M_lime (t/ha x area under cropping) and FracLime
      kind: "rows",
      table: "Table_Input_Lime",
      place: "inputs",
      key: "lime applied",
      rowPrefix: "Application",
      props: FERT_ROWS,
      fields: [
        { field: "ProductDescription", key: "product description" },
        { field: "ProductType", key: "product type" },
        { field: "PercentOfLimestoneInLime", key: "FracLime", percent: true },
        { field: "AmountApplied", key: "amount applied (t/ha)" },
      ],
    },
    {
      // M_organicjf and FN_organicf
      kind: "rows",
      table: "Table_Input_OrganicFertiliser",
      place: "inputs",
      key: "organic fertiliser applied",
      rowPrefix: "Application",
      props: FERT_ROWS,
      fields: [
        { field: "OrganicFertiliserType", key: "organic fertiliser type f" },
        { field: "PercentNInFertiliser", key: "FN_organicf", percent: true },
        { field: "AmountAppliedPerHectare", key: "application rate (kg/ha)" },
        { field: "AmountNAppliedPerHectare", key: `N applied (kg N/ha)${CALC}` },
        { field: "ApplicationArea", key: "area applied (ha)" },
        { field: "TotalOrganicFertiliserApplied", key: `M_organicjf (kg)${CALC}` },
        { field: "TotalNApplied", key: `total N applied (kg)${CALC}` },
      ],
    },
  ],
};

export const AG_RESIDUE: ModuleSpec = {
  test: "AgResidue",
  section: "6 Crop and pasture residues",
  cells: [
    ...SITE_CELLS,
    // Crop residues (6.1, 6.3, 6.4): P_c = area x yield
    { cell: "X_Cell_Crop_CropType", place: "inputs", key: "crop type c" },
    { cell: "X_Cell_Crop_CropPurpose", place: "inputs", key: "crop purpose" },
    { cell: "X_Cell_Crop_IrrigationMethod", place: "inputs", key: "irrigation type ir (crop)" },
    { cell: "X_Cell_Crop_AreaUnderCropping", place: "inputs", key: "area of crop (ha)" },
    { cell: "X_Cell_Crop_YieldPerHectare", place: "inputs", key: "yield (t/ha)" },
    { cell: "X_Cell_Crop_ResidueRemovalMethod", place: "inputs", key: "residue removal method" },
    { cell: "X_Cell_Crop_PercentResidueGrazedCustom", place: "inputs", key: "FFOD_c (stubble-grazed, farm-specific)", percent: true },
    { cell: "X_Cell_Crop_AverageWeightPerBale", place: "inputs", key: "M_B" },
    { cell: "X_Cell_Crop_NumberOfBales", place: "inputs", key: "B" },
    { cell: "X_Cell_Crop_MassResidueRemovedOther", place: "inputs", key: "M_removed" },
    { cell: "X_Cell_Crop_PercentResidueBurned", place: "inputs", key: "F_c", percent: true },
    // Pasture residues (6.2)
    { cell: "X_Cell_Pasture_PastureType", place: "inputs", key: "pasture type p" },
    { cell: "X_Cell_Pasture_IrrigationMethod", place: "inputs", key: "irrigation type ir (pasture)" },
    { cell: "X_Cell_Pasture_AreaUnderPasture", place: "inputs", key: "area of pasture (ha)" },
    { cell: "X_Cell_Pasture_AreaRemovedOrRenewed", place: "inputs", key: "A_p" },
  ],
  tables: [],
};

// ROA_o (t/ha) by organic amendment o, named as Appendix A Table A.2.3.3
const AMENDMENT_FIELDS: FieldSpec[] = [
  { field: "StrawAdded30DaysBefore", key: "ROA_o: Straw incorporated shortly (<30 days) before cultivation" },
  // The workbook's "Straw added 30+ days pre cultivation" column
  { field: "StrawAdded30DaysAfter", key: "ROA_o: Straw incorporated long (>30 days) before cultivation" },
  { field: "Compost", key: "ROA_o: Compost" },
  { field: "FarmYardManure", key: "ROA_o: Farm yard manure" },
  { field: "GreenManure", key: "ROA_o: Green manure" },
  { field: "InorganicFertiliser", key: "inorganic fertiliser (t/ha)" },
];

export const RICE: ModuleSpec = {
  test: "RiceCultivation",
  section: "7 Rice cultivation",
  cells: [...SITE_CELLS, { cell: "X_Cell_NumberGorwingSeasons", place: "inputs", key: "s" }],
  tables: [
    {
      kind: "rows",
      table: "Table_Input_AmendmentBlends",
      place: "inputs",
      key: "organic amendment mixes",
      rowPrefix: "AmendmentMix",
      props: ROWS,
      fields: [{ field: "MixName", key: "name" }, ...AMENDMENT_FIELDS],
    },
    {
      kind: "rows",
      table: "Table_Input_Regimes",
      place: "inputs",
      key: "rice cultivation regimes",
      rowPrefix: "Regime",
      props: ROWS,
      fields: [
        { field: "RegimeName", key: "name" },
        { field: "AreaUnderCultivation", key: "A_ricewpo" },
        { field: "PreCultivationWaterRegime", key: "pre-season water regime p" },
        { field: "WaterRegime", key: "water regime during growing season w" },
        { field: "WaterRegimeSubType", key: "water regime during growing season w (sub-type)" },
        { field: "AmendmentBlend", key: "organic amendment mix" },
        { field: "CultivationPeriod", key: "t_ricewpo" },
      ],
    },
  ],
};
