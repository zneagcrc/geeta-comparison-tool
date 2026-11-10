// Neutral spec for chapter 16 (land use, land use change and forestry): the enterprise workbooks' plantings and clearing
// records, and the share of a planting's removals or a clearing's emissions each enterprise is assigned. There is no
// module test: the spec is used for the enterprise tests only (src/neutral/enterprise.ts).
// Names: the chapter's wording (subscripts as LULUCF_LandUseChange_Equations.xlf lists them: i = activity area,
// j = 1-3 land clearing, j = 4 revegetation by planting), units as the workbook's InputFields labels give them. Columns
// the workbook calculates (formula cells) say so in their name. Source: MG_Chapter16_LULUCF_v1.0.pdf (soft launch).
import { type ModuleSpec, SITE_CELLS } from "../engine";

const ROWS = { MatrixType: "RowsToCols", ColumnOffset: 0, RowOffset: null };
const CALCULATED = "calculated by the workbook";

export const LULUCF: ModuleSpec = {
  test: "LULUCF",
  section: "16 Land use change and forestry",
  cells: [...SITE_CELLS],
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
        { field: "SpeciesCleared", key: `species cleared (${CALCULATED})` },
        { field: "AgeOfTrees", key: `age of trees (years, ${CALCULATED})` },
        { field: "ClearingType", key: "clearing type" },
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
        { field: "SpeciesCleared", key: "species cleared" },
        { field: "AgeOfTrees", key: "age of trees (years)" },
        { field: "ClearingType", key: "clearing type" },
        { field: "AverageAnnualRainfall", key: `average annual rainfall (mm, ${CALCULATED})` },
        { field: "CarbonReleased", key: "carbon released (t C)" },
        { field: "CarbonHeldInProducts", key: "carbon held in products (t C)" },
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
