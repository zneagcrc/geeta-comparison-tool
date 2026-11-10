// Neutral spec for the enterprise workbooks' data quality ratings (Common Requirements Framework v1.0): per input group,
// its temporal representativeness (when the data was sourced), spatial resolution (where it came from) and sample size
// (how much was from direct samples), with notes and evidence. Each row rates one input of the group, by position (the
// rows aren't named in the fixture). The Environmental Plantings workbook still has the older single table, which
// rates the same three things as codes (TR, SR, SS). Used for the enterprise tests only (src/neutral/enterprise.ts).
import { type FieldSpec, type ModuleSpec, type RowTableSpec, SITE_CELLS } from "../engine";

const ROWS = { MatrixType: "RowsToCols", ColumnOffset: 0, RowOffset: null };

const RATINGS: FieldSpec[] = [
  { field: "WhenWasTheDataSourced", key: "temporal representativeness (when was the data sourced)" },
  { field: "WhereIsTheDataSourcedFrom", key: "spatial resolution (where is the data sourced from)" },
  { field: "HowMuchOfTheDataWasFromDirectSamples", key: "sample size (how much of the data was from direct samples)" },
  { field: "Notes", key: "notes" },
  { field: "EvidenceFiles", key: "evidence files" },
  { field: "Score", key: "score (calculated by the workbook)" },
];

const group = (name: string, label: string): RowTableSpec => ({
  kind: "rows",
  table: `Table_Input_DataQuality_${name}`,
  place: "inputs",
  key: `data quality: ${label}`,
  rowPrefix: "Row",
  props: ROWS,
  fields: RATINGS,
});

export const DATA_QUALITY: ModuleSpec = {
  test: "DataQuality",
  section: "Data quality",
  cells: [...SITE_CELLS],
  tables: [
    group("Enterprise", "enterprise"),
    group("Site", "site"),
    group("PastureBeef", "livestock"),
    group("PastureManagement", "pasture management"),
    group("FertiliserApplications", "fertiliser applications"),
    group("FuelElectricity", "fuel and electricity"),
    group("FarmInputsFreightWaste", "farm inputs, freight and waste"),
    {
      kind: "rows",
      table: "Table_Input_DataQuality",
      place: "inputs",
      key: "data quality",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "Input", key: "input" },
        { field: "TemporalRepresentativeness", key: "temporal representativeness (TR)" },
        { field: "SpatialResolution", key: "spatial resolution (SR)" },
        { field: "SampleSize", key: "sample size (SS)" },
        { field: "Notes", key: "notes" },
        { field: "EvidenceFiles", key: "evidence files" },
        { field: "Score", key: "score (calculated by the workbook)" },
      ],
    },
  ],
};
