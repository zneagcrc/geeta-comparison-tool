// Neutral spec for chapter 16 (land use, land use change and forestry). Used by the LULUCF module test and, for the
// parts an enterprise workbook holds, by the enterprise tests (src/neutral/enterprise.ts):
// - planting and clearing records (activity areas i), and the wildfires, planned burns and growth pauses in a planting;
// - FullCAM results for land use change (16.2: woody carbon stock change, biomass burning, harvested wood products,
//   clearing emissions allocation, SOC loss from clearing), SavCAM results for savanna fire management (16.5), and
//   perennial woody crop plantings and clearing (16.6);
// - the share of a planting's removals or a clearing's emissions each enterprise is assigned (enterprises only).
// Names: the catalogue symbol where a value goes straight into an equation (catalogue/veerg-inputs.md, from
// Modules/LULUCF/*.xlf: a_ijy, C_tijy, DeltaC_HRZiy, A_ct, ...); otherwise the chapter's wording, units as the
// workbook's InputFields labels give them (i = activity area; j = land use change activity: 1-3 land clearing,
// 4 revegetation by planting, 5 human-induced regeneration, 6-7 farm or plantation forestry). Columns the workbook
// calculates (formula cells) say so in their name. Source: MG_Chapter16_LULUCF_v1.1.pdf.
import { type ModuleSpec, type TableSpec, SITE_CELLS } from "../engine";

const ROWS = { MatrixType: "RowsToCols", ColumnOffset: 0, RowOffset: null };
const CALCULATED = "calculated by the workbook";

export const LULUCF: ModuleSpec = {
  test: "LULUCF",
  section: "16 Land use change and forestry",
  cells: [
    ...SITE_CELLS,
    // 16.2.1.5 (2): the IBRA7 region r of the land clearing (Table 16.4, SOC change)
    { cell: "X_Cell_PlantingClearing_IBRA7Region", place: "inputs", key: "IBRA7 region r" },
    // 16.6: perennial woody crop type c (the group only narrows the workbook's list of types)
    { cell: "X_Cell_PerennialWoodyCrop_CropGroup", place: "workbook", key: "perennial crop group" },
    { cell: "X_Cell_PerennialWoodyCrop_CropType", place: "inputs", key: "perennial woody crop type c" },
    { cell: "X_Cell_PerennialWoodyCrop_StemDensity", place: "inputs", key: "ActualStemDensity" },
    { cell: "X_Cell_PerennialWoodyCrop_BAMDirect", place: "inputs", key: "BAM_c (directly measured)" },
    { cell: "X_Cell_PerennialWoodyCrop_Method2EstimationApproach", place: "inputs", key: "BAR_c_option (Method 2 estimation approach)" },
  ],
  tables: [
    {
      kind: "rows",
      table: "Table_Input_PlantingInstances",
      place: "inputs",
      // Activity areas i for revegetation by planting (j = 4)
      key: "revegetation by planting (j = 4)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "PlantingName", key: "activity area i" },
        { field: "DatePlanted", key: "date planted" },
        { field: "AreaPlanted", key: "area planted (ha)" },
        { field: "AreaOriginallyPlanted", key: "area originally planted (ha)" },
        { field: "Latitude", key: "latitude" },
        { field: "Longitude", key: "longitude" },
        { field: "Species", key: "species" },
        { field: "AgeOfTrees", key: `age of trees (years, ${CALCULATED})` },
        { field: "AverageAnnualRainfall", key: `average annual rainfall (mm, ${CALCULATED})` },
        { field: "CarbonSequestered", key: "carbon sequestered (t C)" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_ClearingPlantings",
      place: "inputs",
      // Land clearing (j = 1-3) of an activity area planted earlier
      key: "land clearing of plantings (j = 1-3)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "PlantingInstance", key: "activity area i (planting cleared)" },
        { field: "DateCleared", key: "date cleared" },
        { field: "PlantingArea", key: `planting area (ha, ${CALCULATED})` },
        { field: "AreaCleared", key: "area cleared (ha)" },
        { field: "PercentCleared", key: `fraction cleared (${CALCULATED})`, percent: true },
        { field: "AmountCleared", key: `amount cleared (fraction, ${CALCULATED})` },
        { field: "SpeciesCleared", key: `species cleared (${CALCULATED})` },
        { field: "AgeOfTrees", key: `age of trees (years, ${CALCULATED})` },
        { field: "ClearingType", key: "clearing type" },
        { field: "PostClearingDebrisBurnDate", key: "post-clearing debris burn date" },
        { field: "LandUseAfterClearing", key: "land use after clearing" },
        { field: "AverageAnnualRainfall", key: `average annual rainfall (mm, ${CALCULATED})` },
        { field: "CarbonReleased", key: "carbon released (t C)" },
        // The workbook labels this one t CO2 (the other clearing table: t C)
        { field: "CarbonHeldInProducts", key: "carbon held in products (t CO2)" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_ClearingOther",
      place: "inputs",
      // Land clearing (j = 1-3) of vegetation that wasn't a recorded planting
      key: "land clearing of other vegetation (j = 1-3)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "Description", key: "activity area i" },
        { field: "DateCleared", key: "date cleared" },
        { field: "Latitude", key: "latitude" },
        { field: "Longitude", key: "longitude" },
        { field: "AreaOfVegetationBeforeClearing", key: "area of vegetation before clearing (ha)" },
        { field: "AreaCleared", key: "area cleared (ha)" },
        { field: "PercentCleared", key: `fraction cleared (${CALCULATED})`, percent: true },
        { field: "AmountCleared", key: `amount cleared (fraction, ${CALCULATED})` },
        { field: "SpeciesCleared", key: "species cleared" },
        { field: "AgeOfTrees", key: "age of trees (years)" },
        { field: "ClearingType", key: "clearing type" },
        { field: "PostClearingDebrisBurnDate", key: "post-clearing debris burn date" },
        { field: "LandUseAfterClearing", key: "land use after clearing" },
        { field: "AverageAnnualRainfall", key: `average annual rainfall (mm, ${CALCULATED})` },
        { field: "CarbonReleased", key: "carbon released (t C)" },
        { field: "CarbonHeldInProducts", key: "carbon held in products (t C)" },
      ],
    },
    ...(
      [
        ["Table_Input_WildfireEvents", "wildfires in plantings", [["AmountOfPlantingBurned", "fraction of planting burned"], ["TreesKilled", "fraction of trees killed"]]],
        ["Table_Input_PlannedBurns", "planned burns in plantings", [["AmountOfPlantingAffected", "fraction of planting affected"]]],
        ["Table_Input_GrowthPauses", "growth pauses in plantings", [["PauseLength", "pause length (years)"]]],
      ] as const
    ).map(
      ([table, key, own]): TableSpec => ({
        kind: "rows",
        table,
        place: "inputs",
        // Events in a recorded planting (FullCAM's event inputs)
        key,
        rowPrefix: "Row",
        props: ROWS,
        fields: [
          { field: "PlantingInstance", key: "activity area i (planting)" },
          { field: "EventDate", key: "event date" },
          { field: "SpeciesAffected", key: `species affected (${CALCULATED})` },
          ...own.map(([field, k]) => ({ field, key: k })),
        ],
      }),
    ),
    {
      kind: "rows",
      table: "Table_Input_FullCAMResults_WoodyCarbonStockChanges",
      place: "inputs",
      // 16.2.1.2 (2)-(4): FullCAM carbon stock in trees and debris, years y and y-1
      key: "FullCAM woody carbon stock (16.2.1.2)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "ActivityArea", key: "activity area i" },
        { field: "ActivityJ", key: "land use change activity j" },
        { field: "AIJ", key: "a_ijy" },
        { field: "CTIJY1Trees", key: "C_tijyprev" },
        { field: "CTIJYTrees", key: "C_tijy" },
        { field: "CDIJY1Debris", key: "C_dijyprev" },
        { field: "CDIJYDebris", key: "C_dijy" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_FullCAMResults_BiomassBurning",
      place: "inputs",
      // 16.2.1.4 (1): area burnt and FullCAM mass of each gas emitted per hectare burnt
      key: "FullCAM biomass burning (16.2.1.4)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "ActivityAreaI", key: "activity area i" },
        { field: "ActivityJ", key: "land use change activity j" },
        { field: "Fire", key: "fire" },
        { field: "Date", key: "date" },
        { field: "ABurnt", key: "a_gijy" },
        { field: "MCH4", key: "E_gijy (CH4, t/ha burnt)" },
        { field: "MN2O", key: "E_gijy (N2O, t/ha burnt)" },
        { field: "Note", key: "note" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_FullCAMResults_HarvestedWoodProducts",
      place: "inputs",
      // 16.2.1.7 (1): FullCAM carbon in forest products (j = 6-7)
      key: "FullCAM harvested wood products (16.2.1.7)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "ActivityAreaI", key: "activity area i" },
        { field: "DateCleared", key: "date cleared" },
        { field: "AIJY", key: "a_ij67y" },
        { field: "CPIJYWoodProducts", key: "C_pij67y" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_FullCAMResults_ClearingEmissionsAllocation",
      place: "inputs",
      // Appendix A2.6: a clearing's emissions spread over the years after it (FullCAM stocks before and 20 years on,
      // the year's discount factor D_s, and the post-clearing debris burn). Names from the workbook's labels.
      key: "FullCAM clearing emissions allocation",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "ActivityAreaI", key: "activity area i" },
        { field: "DateCleared", key: "date cleared" },
        { field: "AI", key: "a_i (ha)" },
        { field: "CTIJBeforeTrees", key: "C_tij before clearing (trees, t C/ha)" },
        { field: "CTIJAfterTrees20YearsOn", key: "C_tij after clearing, 20 years on (trees, t C/ha)" },
        { field: "CDIJBeforeDebris", key: "C_dij before clearing (debris, t C/ha)" },
        { field: "CDIJAfterDebris20YearsOn", key: "C_dij after clearing, 20 years on (debris, t C/ha)" },
        { field: "TimeSinceClearing", key: "time since clearing (years)" },
        { field: "DS", key: "D_s" },
        { field: "ABurntDebrisBurn", key: "area burnt in the debris burn (ha)" },
        { field: "MCH4DebrisBurn", key: "CH4 emitted in the debris burn (t/ha burnt)" },
        { field: "MN2ODebrisBurn", key: "N2O emitted in the debris burn (t/ha burnt)" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_FullCAMResults_SOCLossFromClearing",
      place: "inputs",
      // 16.2.1.5 (2), 16.3, 16.4: land cleared (j = 1-3) and what it became
      key: "SOC loss from land clearing (16.2.1.5)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "ActivityAreaI", key: "activity area i" },
        { field: "ActivityJ", key: "land clearing activity j (j = 1-3)" },
        { field: "LandUseAfterClearing", key: "land use after clearing" },
        { field: "DateCleared", key: "date cleared" },
        { field: "AIJ", key: "a_ij13y" },
        { field: "AverageAnnualRainfall", key: "average annual rainfall (mm)" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_SavCAMResults_CarbonStockChange",
      place: "inputs",
      // 16.5.1.2 (2): SavCAM abatement report, change in carbon stock
      key: "SavCAM carbon stock change (16.5.1.2)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "ActivityArea", key: "activity area i" },
        { field: "CarbonStockChangeHighRainfall", key: "DeltaC_HRZiy" },
        { field: "CarbonStockChangeLowRainfall", key: "DeltaC_LRZiy" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_SavCAMResults_AnnualEmissions",
      place: "inputs",
      // 16.5.1.4 (1): SavCAM abatement report, emissions from biomass burning
      key: "SavCAM annual emissions (16.5.1.4)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "ActivityArea", key: "activity area i" },
        { field: "AnnualEmissionsHighRainfall", key: "E_HRZiy" },
        { field: "AnnualEmissionsLowRainfall", key: "E_LRZiy" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_PerennialCropPlantings",
      place: "inputs",
      // 16.6.1.1 (1): areas of crop type c planted t years ago
      key: "perennial woody crop plantings (16.6.1.1)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "PlantedAreaName", key: "planted area" },
        { field: "DatePlanted", key: "date planted" },
        { field: "AreaPlanted", key: "A_ct" },
        { field: "YearsSincePlanting", key: `t_ct (${CALCULATED})` },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_PerennialCropClearing",
      place: "inputs",
      // 16.6.1.3 (1), 16.6.1.4 (1): areas of crop type c cleared in the reporting period. The name and area planted
      // come from the planting chosen unless entered.
      key: "perennial woody crop clearing (16.6.1.3)",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "ClearedAreaName", key: "cleared area" },
        { field: "PlantedAreaCleared", key: "planted area cleared" },
        { field: "DateCleared", key: "date cleared" },
        { field: "AreaPlanted", key: "area planted (ha)" },
        { field: "AgeOfClearedTrees", key: `t_clearingc (${CALCULATED})` },
        { field: "AreaCleared", key: "AC_c" },
        { field: "FractionAreaCleared", key: `fraction of area cleared (${CALCULATED})` },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_Enterprise_PlantingRemovals",
      place: "inputs",
      // A planting's removals or a clearing's emissions, recorded by the plantings enterprise, assigned to this enterprise
      key: "plantings and clearing assigned to this enterprise",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "EventName", key: "event" },
        { field: "EventType", key: "event type" },
        { field: "CarbonRemoved", key: "carbon removed (t C)" },
        { field: "CarbonReleased", key: "carbon released (t C)" },
        { field: "PercentAssignedToThisEnterprise", key: "fraction assigned to this enterprise", percent: true },
        { field: "AssignedCarbonRemoved", key: `assigned carbon removed (t C, ${CALCULATED})` },
        { field: "AssignedCarbonReleased", key: `assigned carbon released (t C, ${CALCULATED})` },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_Enterprise_PlantingRemovals_ProductAssignment",
      place: "inputs",
      // The enterprise's assigned share split between its products (dairy: milk and liveweight)
      key: "assigned plantings and clearing by product",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "EventName", key: `event (${CALCULATED})` },
        { field: "AssignedCarbonRemoved", key: `assigned carbon removed (t C, ${CALCULATED})` },
        { field: "AssignedCarbonReleased", key: `assigned carbon released (t C, ${CALCULATED})` },
        { field: "PercentAssignedToMilk", key: "fraction assigned to milk", percent: true },
        { field: "PercentAssignedToLiveweight", key: "fraction assigned to liveweight", percent: true },
        { field: "PercentNotAssignedToAProduct", key: `fraction not assigned to a product (${CALCULATED})`, percent: true },
      ],
    },
  ],
};
