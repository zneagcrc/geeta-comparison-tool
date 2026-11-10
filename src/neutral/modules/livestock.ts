// Neutral specs for the livestock modules (chapters 3 and 4). Names: catalogue symbols where the input goes straight into
// an equation (N_j, D_j, I_j, MMS_jmT1, ...); classes and manure management systems as the pre-release accepted chapter 3
// and 4 subscript tables write them (30 Sep 2026); feedlot groups as Appendix A Table A.1.1.3 names the feedlot types.
// Method 1 default tables that the workbook fills in from Appendix A go in the `workbook` block; the manure
// destinations (sold / fertiliser for own farm / direct application to soil) behind PF are activity data, in `inputs`.
import { type CellSpec, type ColTableSpec, type FieldSpec, type ModuleSpec, SITE_CELLS } from "../engine";

const COLS = { MatrixType: "ColsToRows", ColumnOffset: null, RowOffset: null };

/** Chapter 4 manure management systems m (general table at the start of chapter 4). */
export const MMS = {
  AnaerobicLagoon: "1 = Anaerobic lagoon",
  SolidStorage: "4 = Solid storage",
  Drylot: "5 = Drylot",
  Composting: "6 = Composting (passive windrow)",
  DigesterCoveredLagoons: "7 = Digestor/Covered lagoon",
  DeepLitter: "8 = Deep litter",
  PitStorage: "9 = Pit storage (<1 month)",
  DirectApplication: "13 = Direct application",
} as const;

/** Where manure from a system goes (the workbook's destination split behind PF). */
const destinations = (ownFarmColumn: string) => ({ Sold: "sold", [ownFarmColumn]: "fertiliser for own farm", DirectApplication: "direct application to soil" });
const FEEDLOT_DESTINATIONS = destinations("FertOwnFarms");
const PIG_DESTINATIONS = destinations("FertOwnFarm");

const cols = (table: string, members: Record<string, string>, fields: FieldSpec[], props: Record<string, unknown> = COLS, place: "inputs" | "workbook" = "inputs"): ColTableSpec => ({
  kind: "cols",
  table,
  place,
  members,
  fields,
  props,
});

// --- feedlot (3.1, 4.1) ------------------------------------------------------------------

/** Feedlot groups j, as the workbook's three feedlot types (Appendix A Table A.1.1.3). */
const FEEDLOT_GROUPS = { Domestic: "Domestic", MidFed: "Mid-fed", LongFed: "Long-fed" };

const FEEDLOT_DIET: FieldSpec[] = [
  { field: "FeedIntake", key: "I_j" },
  { field: "EtherExtract", key: "EE_j" },
  { field: "NDF", key: "NDF_j" },
  { field: "DryMatterDigestibility", key: "DMD_j" },
  { field: "CrudeProtein", key: "CP_j" },
  { field: "NRetention", key: "NR_j" },
];
const FEEDLOT_HERD = cols("X_Table_Feedlot_HerdMovement", FEEDLOT_GROUPS, [
  { field: "Head", key: "N_j" },
  { field: "Duration", key: "D_j" },
]);
// Method 2 farm data; the Method 1 defaults (Table A.1.1.3) are workbook lookups
const FEEDLOT_DIET_M2 = cols("X_Table_Feedlot_Intake_Method2", FEEDLOT_GROUPS, FEEDLOT_DIET);
const FEEDLOT_DIET_M1 = cols(
  "X_Table_Feedlot_Intake_Method1",
  FEEDLOT_GROUPS,
  FEEDLOT_DIET.map((f) => ({ ...f, key: "Method 1 default diet (Table A.1.1.3)", sub: [f.key] })),
  COLS,
  "workbook",
);

export const ENTERIC_FEEDLOT: ModuleSpec = {
  test: "EntericMethane.Feedlot",
  section: "3.1 Beef feedlot",
  cells: [...SITE_CELLS],
  tables: [FEEDLOT_HERD, FEEDLOT_DIET_M2],
};

export const MANURE_FEEDLOT: ModuleSpec = {
  test: "ManureManagement.Feedlot",
  section: "4.1 Beef feedlot",
  cells: [
    ...SITE_CELLS,
    { cell: "X_Cell_Feedlot_GrazingProductionSystem", place: "inputs", key: "production system j (where manure is applied)" },
    { cell: "X_Cell_Feedlot_GrazingIrrigationMethod", place: "inputs", key: "irrigation method ir" },
  ],
  tables: [
    FEEDLOT_HERD,
    FEEDLOT_DIET_M1,
    FEEDLOT_DIET_M2,
    cols("X_Table_Feedlot_MMS_Stage1", FEEDLOT_GROUPS, [{ field: "Drylot", key: "MMS_jmT1", sub: [MMS.Drylot], percent: true }]),
    cols(
      "X_Table_Feedlot_MMS_Stage2",
      FEEDLOT_GROUPS,
      (["SolidStorage", "Composting", "DirectApplication"] as const).map((m) => ({ field: m, key: "MMS_jmT2", sub: [MMS[m]], percent: true })),
      { ...COLS, RowOffset: 2 },
    ),
    cols(
      "X_Table_Feedlot_MMS_Stage2_Destinations",
      FEEDLOT_DESTINATIONS,
      (["SolidStorage", "Composting", "DirectApplication"] as const).map((m) => ({ field: m, key: "manure destinations", sub: [MMS[m]], percent: true })),
      { ...COLS, ColumnOffset: 0, RowOffset: 2 },
    ),
    cols("X_Table_Feedlot_MMS_Stage3", FEEDLOT_GROUPS, [{ field: "AnaerobicLagoon", key: "MMS_jmT3", sub: [MMS.AnaerobicLagoon], percent: true }], {
      ...COLS,
      RowOffset: 2,
    }),
    cols(
      "X_Table_Feedlot_MMS_Stage3_Destinations",
      FEEDLOT_DESTINATIONS,
      [{ field: "AnaerobicLagoon", key: "manure destinations", sub: [MMS.AnaerobicLagoon], percent: true }],
      { ...COLS, ColumnOffset: 0, RowOffset: 2 },
    ),
  ],
};

// --- pigs (3.5, 4.5) ---------------------------------------------------------------------

// Class 4 was "Others" in the fixtures until 2026-10-26
const PIG_CLASSES = { Boars: "1 = Boars", Sows: "2 = Sows", Gilts: "3 = Gilts", SlaughterPigs: "4 = Slaughter pigs" };
const PIG_HERD = cols("X_Table_Pigs_HerdMovement", PIG_CLASSES, [
  { field: "Duration", key: "D_j" },
  { field: "Head", key: "N_j" },
]);

export const ENTERIC_PIGS: ModuleSpec = {
  test: "EntericMethane.Pigs",
  section: "3.5 Pigs",
  cells: [...SITE_CELLS],
  tables: [
    PIG_HERD,
    cols("X_Table_Pigs_FeedIntake_Method1", PIG_CLASSES, [{ field: "FeedIntake", key: "Method 1 default feed intake", sub: ["I_j"] }], COLS, "workbook"),
    cols("X_Table_Pigs_FeedIntake_Method2", PIG_CLASSES, [{ field: "FeedIntake", key: "I_j" }]),
  ],
};

/** Pig primary (stage 1) systems with their own workbook table and solids-separation cells. */
const PIG_PRIMARY = ["AnaerobicLagoon", "Drylot", "DigesterCoveredLagoons", "DeepLitter", "PitStorage"] as const;
const PIG_FROM = [...PIG_PRIMARY, "SolidStorage"] as const;
const PIG_TO = ["AnaerobicLagoon", "DigesterCoveredLagoons", "DeepLitter", "PitStorage", "DirectApplication"] as const;

const pigSeparation: CellSpec[] = PIG_PRIMARY.flatMap((m) => [
  { cell: `X_Cell_Pigs_Stage1MMS_${m}_SolidsSeparated`, place: "inputs" as const, key: ["solids separated", MMS[m]], values: { Yes: true, No: false } },
  { cell: `X_Cell_Pigs_Stage1MMS_${m}_AmountSeparated_Method1`, place: "inputs" as const, key: ["SS_m (Method 1)", MMS[m]], percent: true },
  { cell: `X_Cell_Pigs_Stage1MMS_${m}_AmountSeparated_Method2`, place: "inputs" as const, key: ["SS_m (Method 2)", MMS[m]], percent: true },
]);

export const MANURE_PIGS: ModuleSpec = {
  test: "ManureManagement.Pigs",
  section: "4.5 Pigs",
  cells: [
    ...SITE_CELLS,
    { cell: "X_Cell_Pigs_ManureAppliedProductionSystem", place: "inputs", key: "production system j (where manure is applied)" },
    { cell: "X_Cell_Pigs_ManureAppliedIrrigationMethod", place: "inputs", key: "irrigation method ir" },
    { cell: "X_Cell_Pigs_ProductionSystem", place: "inputs", key: "housing system" },
    ...pigSeparation,
  ],
  tables: [
    PIG_HERD,
    cols(
      "X_Table_Pigs_ManureProduction_Method1",
      PIG_CLASSES,
      [
        { field: "VolatileSolids", key: "Method 1 default manure production", sub: ["VS_j"] },
        { field: "NitrogenProduced", key: "Method 1 default manure production", sub: ["NW_j"] },
      ],
      COLS,
      "workbook",
    ),
    cols("X_Table_Pigs_ManureProduction_Method2", PIG_CLASSES, [
      { field: "VolatileSolids", key: "VS_j" },
      { field: "NitrogenProduced", key: "NW_j" },
    ]),
    ...[...PIG_PRIMARY, "SolidStorage" as const].map((m) =>
      cols(`X_Table_Pigs_Stage1MMS_${m}`, PIG_CLASSES, [{ field: m, key: "MMS_jmT1", sub: [MMS[m]], percent: true }]),
    ),
    ...PIG_FROM.map((from) =>
      cols(
        `X_Table_Pigs_Stage2MMS_From_${from}`,
        PIG_CLASSES,
        PIG_TO.filter((to) => to !== from).map((to) => ({ field: to, key: "MMS_jmT2", sub: [MMS[from], MMS[to]], percent: true })),
      ),
    ),
    ...PIG_FROM.map((from) =>
      cols(
        `X_Table_Pigs_Stage2MMS_From_${from}_Destinations`,
        PIG_DESTINATIONS,
        PIG_TO.filter((to) => to !== from).map((to) => ({ field: to, key: "manure destinations", sub: [MMS[from], MMS[to]], percent: true })),
      ),
    ),
  ],
};

// --- dairy (3.3, 4.3) --------------------------------------------------------------------

const DAIRY_CLASSES = {
  MilkingCows: "1 = Milking cows",
  HeifersOver1Year: "2 = Heifers > 1 year",
  HeifersUnder1Year: "3 = Heifers < 1 year",
  BullsOver1Year: "4 = Bulls > 1 year",
  BullsUnder1Year: "5 = Bulls < 1 year",
};
/** Where dairy cattle spend their time; manure from the milking shed (1) and feed pad (2) goes to the MMS. */
export const DAIRY_LOCATIONS = { Pasture: "pasture", MilkingShed: "milking shed", FeedPad: "feed pad" } as const;
const DAIRY_LOCATION_BY_NUMBER = { 1: DAIRY_LOCATIONS.MilkingShed, 2: DAIRY_LOCATIONS.FeedPad } as const;
export const DAIRY_MMS = {
  AnaerobicLagoon: MMS.AnaerobicLagoon,
  SumpAndDispersal: "3a = Sump and dispersal",
  DrainsToPaddock: "3b = Drains to paddock",
  SolidStorage: MMS.SolidStorage,
} as const;
/** The workbook's Method 1 tables are lookups (Appendix A, or the production system template). */
export const DAIRY_DEFAULTS = "Method 1 defaults (workbook lookups)";

/** A table with a Method 1 (workbook lookup) and a Method 2 (farm data) version. */
const byMethod = (name: string, members: Record<string, string>, fields: FieldSpec[]): ColTableSpec[] => [
  cols(`${name}_Method1`, members, fields.map((f) => ({ ...f, key: DAIRY_DEFAULTS, sub: [f.key, ...(f.sub ?? [])] })), COLS, "workbook"),
  cols(`${name}_Method2`, members, fields),
];

const DAIRY_HERD_TABLES: ColTableSpec[] = [
  cols("X_Table_Dairy_HerdMovement", DAIRY_CLASSES, [{ field: "Head", key: "N_j" }]),
  ...byMethod("X_Table_Dairy_Liveweight", DAIRY_CLASSES, [
    { field: "AverageLiveweight", key: "W_j" },
    { field: "LiveweightGain", key: "LWG_j" },
  ]),
  ...byMethod("X_Table_Dairy_DurationOfStay", DAIRY_CLASSES, [
    // D_j (weaned, or the whole stay for classes 1, 2, 4) and DPW_j (pre-weaned calves)
    { field: "DurationWeaned", key: "D_j" },
    { field: "DurationPreWeaned", key: "DPW_j" },
  ]),
  ...byMethod("X_Table_Dairy_Diet", DAIRY_CLASSES, [
    { field: "DryMatterDigestibility", key: "DMD_j" },
    { field: "CrudeProtein", key: "CP_j" },
  ]),
  cols("X_Table_Dairy_MilkSolidAttributes", { Method1: "Method 1", Method2: "Method 2" }, [
    { field: "FatContent", key: "FC_j", percent: true },
    { field: "ProteinContent", key: "PC_j", percent: true },
  ]),
];

const DAIRY_MILK_CELLS: CellSpec[] = [
  { cell: "X_Cell_Dairy_Breed", place: "inputs", key: "breed" },
  { cell: "X_Cell_Dairy_MilkProductionUnit", place: "inputs", key: "MPU" },
  // MP_j (litres/head/day) or MS_j (kg milk solids/head/day) for milking cows, by MPU
  { cell: "X_Cell_Dairy_MilkProductionAmount", place: "inputs", key: "milk production (milking cows, in MPU)" },
];

export const ENTERIC_DAIRY: ModuleSpec = {
  test: "EntericMethane.Dairy",
  section: "3.3 Dairy",
  cells: [...SITE_CELLS, ...DAIRY_MILK_CELLS],
  tables: DAIRY_HERD_TABLES,
};

const dairySeparation: CellSpec[] = ([1, 2] as const).flatMap((loc) =>
  (["AnaerobicLagoon", "SumpAndDispersal", "DrainsToPaddock"] as const).flatMap((m) => [
    {
      cell: `X_Cell_Dairy_Stage1MMS_${loc}_${m}_SolidsSeparated`,
      place: "inputs" as const,
      key: ["solids separated", DAIRY_LOCATION_BY_NUMBER[loc], DAIRY_MMS[m]],
      values: { Yes: true, No: false },
    },
    { cell: `X_Cell_Dairy_Stage1MMS_${loc}_${m}_AmountSeparated_Method1`, place: "inputs" as const, key: ["SS_m (Method 1)", DAIRY_LOCATION_BY_NUMBER[loc], DAIRY_MMS[m]], percent: true },
    { cell: `X_Cell_Dairy_Stage1MMS_${loc}_${m}_AmountSeparated_Method2`, place: "inputs" as const, key: ["SS_m (Method 2)", DAIRY_LOCATION_BY_NUMBER[loc], DAIRY_MMS[m]], percent: true },
  ]),
);

const DAIRY_DESTINATIONS = destinations("FertOwnFarm");

export const MANURE_DAIRY: ModuleSpec = {
  test: "ManureManagement.Dairy",
  section: "4.3 Dairy",
  cells: [
    ...SITE_CELLS,
    ...DAIRY_MILK_CELLS,
    { cell: "X_Cell_Dairy_ProductionSystemTemplate", place: "workbook", key: "production system template" },
    { cell: "X_Cell_Dairy_ManureAppliedProductionSystem", place: "inputs", key: "production system j (where manure is applied)" },
    { cell: "X_Cell_Dairy_ManureAppliedIrrigationMethod", place: "inputs", key: "irrigation method ir" },
    ...dairySeparation,
  ],
  tables: [
    ...DAIRY_HERD_TABLES,
    ...byMethod(
      "X_Table_Dairy_ProductionSystems",
      DAIRY_CLASSES,
      (["Pasture", "MilkingShed", "FeedPad"] as const).map((l) => ({ field: l, key: "fraction of time in location", sub: [DAIRY_LOCATIONS[l]], percent: true })),
    ),
    ...([1, 2] as const).flatMap((loc) =>
      (["AnaerobicLagoon", "SumpAndDispersal", "DrainsToPaddock", "SolidStorage"] as const).flatMap((m) => [
        cols(`X_Table_Dairy_Stage1MMS_${loc}_${m}`, DAIRY_CLASSES, [
          { field: m, key: "MMS_jm", sub: [DAIRY_LOCATION_BY_NUMBER[loc], DAIRY_MMS[m]], percent: true },
        ]),
        cols(`X_Table_Dairy_Stage1MMS_${loc}_${m}_Destinations`, DAIRY_DESTINATIONS, [
          { field: m, key: "manure destinations", sub: [DAIRY_LOCATION_BY_NUMBER[loc], DAIRY_MMS[m]], percent: true },
        ]),
      ]),
    ),
  ],
};

// --- pasture beef (3.2, 4.2) and sheep (3.4, 4.4) ------------------------------------------
// Method 1 takes seasonal data (Spring ... Winter), Method 2 monthly data; time periods are kept as the workbook labels
// them ("Spring", "January 2025", "January"). Head, duration and calving / lambing / marking rates are farm data for
// both methods; liveweight, liveweight gain, DMD, CP and feed availability for Method 1 are workbook lookups.

const BEEF_CLASSES = {
  BullsUnder1Year: "1 = Bulls < 1 year",
  BullsOver1Year: "2 = Bulls > 1 year",
  CowsUnder1Year: "3 = Cows < 1 year",
  Cows1To2Years: "4 = Cows 1-2 years",
  Cows2To3Years: "5a = Cows 2-3 years",
  CowsOver3Years: "5b = Cows > 3 years",
  SteersUnder1Year: "6 = Steers < 1 year",
  Steers1To2Years: "7a = Steers 1-2 years",
  Steers2To3Years: "7b = Steers 2-3 years",
  SteersOver3Years: "7c = Steers >3 years",
};
/** Workbook lookups for Method 1 live under `${LIVESTOCK_DEFAULTS}: <symbol>` -> class -> season. */
export const LIVESTOCK_DEFAULTS = "Method 1 defaults (workbook lookups)";
export const METHOD1_SEASONS = " (Method 1, seasons)";
export const METHOD2_MONTHS = " (Method 2, months)";
const M1 = METHOD1_SEASONS;
const M2 = METHOD2_MONTHS;

/** A class x time-period table of farm data: { key: { class: { period: value } } }. */
const periods = (table: string, members: Record<string, string>, key: string, props: Record<string, unknown>): ColTableSpec => ({
  kind: "cols",
  table,
  place: "inputs",
  members,
  fields: [],
  anyField: { key },
  props,
});

/** A class x season table of Method 1 workbook lookups. */
const defaults = (table: string, members: Record<string, string>, symbol: string, props: Record<string, unknown>): ColTableSpec => ({
  kind: "cols",
  table,
  place: "workbook",
  members,
  fields: [],
  anyField: { key: `${LIVESTOCK_DEFAULTS}: ${symbol}` },
  props,
});

const BEEF_ROWS = { MatrixType: "RowsToCols", ColumnOffset: null, RowOffset: null };
const offset = (n: number) => ({ ColumnOffset: n, RowOffset: null });

const BEEF_TABLES: ColTableSpec[] = [
  periods("X_Table_PastureBeef_Duration_Method1", BEEF_CLASSES, `D_j${M1}`, COLS),
  periods("X_Table_PastureBeef_Duration_Method2", BEEF_CLASSES, `D_j${M2}`, COLS),
  periods("X_Table_PastureBeef_Head_Method1", BEEF_CLASSES, `N_jkl${M1}`, COLS),
  periods("X_Table_PastureBeef_Head_Method2", BEEF_CLASSES, `N_jkl${M2}`, COLS),
  defaults("X_Table_PastureBeef_Liveweight_Method1", BEEF_CLASSES, "W_jkl", COLS),
  periods("X_Table_PastureBeef_Liveweight_Method2", BEEF_CLASSES, `W_jkl${M2}`, COLS),
  defaults("X_Table_PastureBeef_LiveweightGain_Method1", BEEF_CLASSES, "LWG_jkl", COLS),
  periods("X_Table_PastureBeef_LiveweightGain_Method2", BEEF_CLASSES, `LWG_jkl${M2}`, COLS),
  defaults("X_Table_PastureBeef_DryMatterDigestibility_Method1", BEEF_CLASSES, "DMD_jkl", COLS),
  periods("X_Table_PastureBeef_DryMatterDigestibility_Method2", BEEF_CLASSES, `DMD_jkl${M2}`, COLS),
  defaults("X_Table_PastureBeef_CrudeProtein_Method1", BEEF_CLASSES, "CP_jkl", COLS),
  periods("X_Table_PastureBeef_CrudeProtein_Method2", BEEF_CLASSES, `CP_jkl${M2}`, COLS),
  {
    // Seasons as rows: the share of cows calving in each season (whole per cent) and whether it is a calving season
    kind: "cols",
    table: "X_Table_PastureBeef_ProportionCowsCalving_Method1",
    place: "inputs",
    container: "Rows",
    members: "as-is",
    props: BEEF_ROWS,
    fields: [
      { field: "IsItACalvingSeason", key: `is it a calving season${M1}` },
      { field: "CalvingSeason", key: `calving season${M1}`, place: "workbook" },
      { field: "SeasonAfterCalving", key: `season after calving${M1}`, place: "workbook" },
      ...(["Cows1To2Years", "Cows2To3Years", "CowsOver3Years"] as const).map((c) => ({
        field: c,
        key: `proportion of cows calving (per cent)${M1}`,
        sub: [BEEF_CLASSES[c]],
        swap: true,
      })),
    ],
  },
  {
    kind: "cols",
    table: "X_Table_PastureBeef_CalvingRates_Method1",
    place: "inputs",
    container: "Rows",
    members: "as-is",
    props: BEEF_ROWS,
    fields: [
      // The workbook repeats the calving-season flags of the cows table here
      { field: "IsItACalvingSeason", key: `calving rates: is it a calving season${M1}`, place: "workbook" },
      { field: "CalvingSeason", key: `calving rates: calving season${M1}`, place: "workbook" },
      { field: "SeasonAfterCalving", key: `calving rates: season after calving${M1}`, place: "workbook" },
      ...(["BullsUnder1Year", "CowsUnder1Year", "SteersUnder1Year"] as const).map((c) => ({
        field: c,
        key: `calving rate (per cent)${M1}`,
        sub: [BEEF_CLASSES[c]],
        swap: true,
      })),
    ],
  },
  {
    kind: "cols",
    table: "X_Table_PastureBeef_ProportionCowsCalving_Method2",
    place: "inputs",
    container: "Rows",
    members: "as-is",
    fields: [
      { field: "CalvingStartMonth", key: `calving season start month${M2}` },
      ...(["Cows1To2Years", "Cows2To3Years", "CowsOver3Years"] as const).map((c) => ({
        field: c,
        key: `proportion of cows calving${M2}`,
        sub: [BEEF_CLASSES[c]],
        swap: true,
        percent: true,
      })),
    ],
    // Workbook-calculated columns sit between these, so the generator writes each at its own offset
    blocks: [
      { props: offset(1), fields: ["CalvingStartMonth"] },
      { props: offset(4), fields: ["Cows1To2Years"] },
      { props: offset(6), fields: ["Cows2To3Years"] },
      { props: offset(8), fields: ["CowsOver3Years"] },
    ],
  },
  {
    kind: "cols",
    table: "X_Table_PastureBeef_CalvingRates_Method2",
    place: "inputs",
    container: "Rows",
    members: "as-is",
    fields: (["BullsUnder1Year", "CowsUnder1Year", "SteersUnder1Year"] as const).map((c) => ({
      field: c,
      key: `calving rate (per cent)${M2}`,
      sub: [BEEF_CLASSES[c]],
      swap: true,
    })),
    blocks: [
      { props: offset(4), fields: ["BullsUnder1Year"] },
      { props: offset(6), fields: ["CowsUnder1Year"] },
      { props: offset(8), fields: ["SteersUnder1Year"] },
    ],
  },
];

const grazingCells = (animal: "PastureBeef" | "Sheep"): CellSpec[] => [
  { cell: `X_Cell_${animal}_FencedWater`, place: "inputs", key: "fenced water sources", values: { Yes: true, No: false } },
  { cell: `X_Cell_${animal}_GrazingProductionSystem`, place: "inputs", key: "production system j" },
  { cell: `X_Cell_${animal}_GrazingIrrigationMethod`, place: "inputs", key: "irrigation method ir" },
];

const BEEF_CELLS: CellSpec[] = [
  ...SITE_CELLS,
  { cell: "X_Cell_PastureBeef_ProductionRegion", place: "inputs", key: "production region" },
  { cell: "X_Cell_PastureBeef_Breed", place: "inputs", key: "breed of cattle b" },
  ...grazingCells("PastureBeef"),
];

export const ENTERIC_BEEF: ModuleSpec = { test: "EntericMethane.PastureBeef", section: "3.2 Pasture beef", cells: BEEF_CELLS, tables: BEEF_TABLES };
export const MANURE_BEEF: ModuleSpec = { test: "ManureManagement.PastureBeef", section: "4.2 Pasture beef", cells: BEEF_CELLS, tables: BEEF_TABLES };
export { BEEF_CLASSES };

const SHEEP_CLASSES = {
  Rams: "1 = Rams",
  Wethers: "2 = Wethers",
  MaidenEwes: "3 = Maiden ewes",
  BreedingEwes: "4 = Breeding ewes",
  OtherEwes: "5 = Other ewes",
  LambsAndHoggets: "6 = Lambs and hoggets",
};
const EWES = { MaidenEwes: SHEEP_CLASSES.MaidenEwes, BreedingEwes: SHEEP_CLASSES.BreedingEwes };
const SHEEP_PROPS = { ColumnOffset: null, RowOffset: null };

const SHEEP_TABLES: ColTableSpec[] = [
  periods("X_Table_Sheep_Duration_Method1", SHEEP_CLASSES, `D_j${M1}`, SHEEP_PROPS),
  periods("X_Table_Sheep_Duration_Method2", SHEEP_CLASSES, `D_j${M2}`, SHEEP_PROPS),
  periods("X_Table_Sheep_Head_Method1", SHEEP_CLASSES, `N_jk${M1}`, SHEEP_PROPS),
  periods("X_Table_Sheep_Head_Method2", SHEEP_CLASSES, `N_jk${M2}`, SHEEP_PROPS),
  defaults("X_Table_Sheep_Liveweight_Method1", SHEEP_CLASSES, "W_jk", SHEEP_PROPS),
  periods("X_Table_Sheep_Liveweight_Method2", SHEEP_CLASSES, `W_jk${M2}`, SHEEP_PROPS),
  defaults("X_Table_Sheep_LiveweightGain_Method1", SHEEP_CLASSES, "LWG_jk", SHEEP_PROPS),
  periods("X_Table_Sheep_LiveweightGain_Method2", SHEEP_CLASSES, `LWG_jk${M2}`, SHEEP_PROPS),
  defaults("X_Table_Sheep_DryMatterDigestibility_Method1", SHEEP_CLASSES, "DMD_jk", SHEEP_PROPS),
  periods("X_Table_Sheep_DryMatterDigestibility_Method2", SHEEP_CLASSES, `DMD_jk${M2}`, SHEEP_PROPS),
  defaults("X_Table_Sheep_CrudeProtein_Method1", SHEEP_CLASSES, "CP_jk", SHEEP_PROPS),
  periods("X_Table_Sheep_CrudeProtein_Method2", SHEEP_CLASSES, `CP_jk${M2}`, SHEEP_PROPS),
  defaults("X_Table_Sheep_FeedAvailability_Method1", SHEEP_CLASSES, "DMA_jk", SHEEP_PROPS),
  periods("X_Table_Sheep_FeedAvailability_Method2", SHEEP_CLASSES, `DMA_jk${M2}`, SHEEP_PROPS),
  periods("X_Table_Sheep_LambingRates_Method1", EWES, `LR_jk (per cent)${M1}`, SHEEP_PROPS),
  {
    kind: "cols",
    table: "X_Table_Sheep_LambingRates_Method2",
    place: "inputs",
    members: EWES,
    memberKeys: { LambingStartMonth: `lambing season start month${M2}` },
    fields: [],
    anyField: { key: `LR_jk (per cent)${M2}` },
    blocks: [
      { props: { ColumnOffset: 1, RowOffset: null }, members: ["LambingStartMonth"] },
      { props: { ColumnOffset: 3, RowOffset: null }, members: ["MaidenEwes"] },
      { props: { ColumnOffset: 5, RowOffset: null }, members: ["BreedingEwes"] },
    ],
  },
  periods("X_Table_Sheep_LambMarkingRates_Method1", EWES, `LMR_jk (per cent)${M1}`, SHEEP_PROPS),
  {
    kind: "cols",
    table: "X_Table_Sheep_LambMarkingRates_Method2",
    place: "inputs",
    members: EWES,
    fields: [],
    anyField: { key: `LMR_jk (per cent)${M2}` },
    blocks: [
      { props: { ColumnOffset: 3, RowOffset: null }, members: ["MaidenEwes"] },
      { props: { ColumnOffset: 5, RowOffset: null }, members: ["BreedingEwes"] },
    ],
  },
  cols(
    "X_Table_Sheep_WoolProduction",
    SHEEP_CLASSES,
    [
      { field: "AverageGreasyWoolProductionPerHead", key: "GW_k" },
      { field: "AverageCleanWoolYield", key: "Y_k" },
    ],
    SHEEP_PROPS,
  ),
];

const SHEEP_CELLS: CellSpec[] = [...SITE_CELLS, ...grazingCells("Sheep")];
export const ENTERIC_SHEEP: ModuleSpec = { test: "EntericMethane.Sheep", section: "3.4 Sheep", cells: SHEEP_CELLS, tables: SHEEP_TABLES };
export const MANURE_SHEEP: ModuleSpec = { test: "ManureManagement.Sheep", section: "4.4 Sheep", cells: SHEEP_CELLS, tables: SHEEP_TABLES };
export { SHEEP_CLASSES };
