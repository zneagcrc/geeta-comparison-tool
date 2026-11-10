// Neutral specs for chapters 8-14 (fuel, refrigerants, solid waste, wastewater, supplementary CO2, electricity).
// Names: catalogue symbols where the input goes straight into an equation (catalogue/veerg-inputs.md), otherwise the
// chapter's wording; single-letter subscripts by their description; dimension members as Appendix A's tables write them.
// Source documents: pre-release accepted chapters 8-9, 10-13 and 14-15 (14 Oct 2026) and Appendix A (18 Sep 2026).
import { type ModuleSpec, SITE_CELLS } from "../engine";

const ROWS = { MatrixType: "RowsToCols", ColumnOffset: 0, RowOffset: null };

export const FUEL: ModuleSpec = {
  test: "Fuel",
  section: "8 Fuel use",
  cells: [...SITE_CELLS, { cell: "X_Cell_Fuel_IsMetroLocation", place: "inputs", key: "metro or non-metro location" }],
  tables: [
    {
      kind: "rows",
      table: "Table_Input_Fuel",
      place: "inputs",
      // Q_Trans,q / Q_SC,q: "all fuel purchased in the reporting period" may be taken as consumed (8.1, 8.2)
      key: "fuel purchased",
      rowPrefix: "Row",
      props: { ...ROWS, AllowOverride: true },
      fields: [
        { field: "FuelUse", key: "use (transport type or stationary combustion)" },
        { field: "FuelType", key: "fuel type q" },
        { field: "AmountPurchased", key: "amount purchased" },
        { field: "AmountUnit", key: "unit" },
        { field: "PercentConsumed", key: "fraction consumed in the reporting period", percent: true },
      ],
    },
  ],
};

export const REFRIGERANTS: ModuleSpec = {
  test: "Refrigerants",
  section: "9 Refrigerant use",
  cells: [...SITE_CELLS],
  tables: [
    {
      kind: "rows",
      table: "Table_Input_Refrigerant",
      place: "inputs",
      // charge_Ra = capacity per unit x number of units
      key: "appliances",
      rowPrefix: "RefrigerantUnit",
      props: ROWS,
      fields: [
        { field: "UnitName", key: "name" },
        { field: "ApplianceType", key: "appliance type a" },
        { field: "Refrigerant", key: "refrigerant R" },
        { field: "RefrigerantGasCapacity", key: "refrigerant contained per unit (kg)" },
        { field: "NumberOfUnits", key: "number of units" },
      ],
    },
  ],
};

export const SUPPLEMENTARY_CO2: ModuleSpec = {
  test: "SupplementaryCO2",
  section: "12 Supplementary CO2",
  cells: [...SITE_CELLS],
  tables: [
    {
      kind: "rows",
      table: "Table_Input_SupplementaryCO2",
      place: "inputs",
      // Q = the total of these (kg CO2)
      key: "supplementary CO2 used",
      rowPrefix: "Treatment",
      props: ROWS,
      fields: [
        { field: "Description", key: "description" },
        { field: "Amount", key: "quantity (kg CO2)" },
      ],
    },
  ],
};

export const WASTE_SOLID: ModuleSpec = {
  test: "WasteSolid",
  section: "10 Solid waste",
  cells: [
    ...SITE_CELLS,
    { cell: "X_Cell_SolidWaste_AmountWasteComposted_Onsite", place: "inputs", key: ["Q_t", "Composting"] },
    { cell: "X_Cell_SolidWaste_AmountWasteInAnaerobicLagoon_Onsite", place: "inputs", key: ["Q_t", "Anaerobic digestion"] },
    { cell: "X_Cell_SolidWaste_AmountWasteOpenBurned_Onsite", place: "inputs", key: "Q_burn" },
    { cell: "X_Cell_SolidWaste_AmountWasteUnmanagedDeep_Onsite", place: "inputs", key: ["Q_u", "Unmanaged - deep"] },
    { cell: "X_Cell_SolidWaste_AmountWasteUnmanagedShallow_Onsite", place: "inputs", key: ["Q_u", "Unmanaged - shallow"] },
    { cell: "X_Cell_SolidWaste_AmountWasteUnmanagedBurial_Onsite", place: "inputs", key: ["Q_u", "Burial"] },
  ],
  tables: [
    {
      kind: "rows",
      table: "Table_Input_OpenBurning_Onsite",
      place: "inputs",
      // Q_burn,w (tonnes) or V_burn,w (m3), by the unit
      key: "open burning by waste type",
      rowPrefix: "OpenBurning",
      props: ROWS,
      fields: [
        { field: "Description", key: "description" },
        { field: "WasteType", key: "waste type w" },
        { field: "Amount", key: "amount" },
        { field: "AmountUnit", key: "unit" },
      ],
    },
    {
      kind: "rows",
      table: "Table_Input_UnmanagedWaste_Onsite",
      place: "inputs",
      // Q_w,u
      key: "unmanaged disposal by waste type",
      rowPrefix: "Unmanaged",
      props: ROWS,
      fields: [
        { field: "Description", key: "description" },
        { field: "WasteType", key: "waste type w" },
        { field: "DisposalMethod", key: "unmanaged waste disposal method u" },
        { field: "Amount", key: "amount" },
        { field: "AmountUnit", key: "unit" },
      ],
    },
  ],
};

export const WASTEWATER: ModuleSpec = {
  test: "Wastewater",
  section: "11 Wastewater treatment",
  cells: [
    ...SITE_CELLS,
    { cell: "X_Cell_Wastewater_Commodity", place: "inputs", key: "commodity c" },
    { cell: "X_Cell_Wastewater_TreatmentFacilityType", place: "inputs", key: "treatment facility type t" },
    { cell: "X_Cell_Wastewater_QuantityInM3", place: "inputs", key: "W_t" },
    // Method 2 measurements (Method 1 uses the commodity defaults)
    { cell: "X_Cell_Wastewater_InletCOD_Method2", place: "inputs", key: "COD_inc" },
    { cell: "X_Cell_Wastewater_FractionCODRemovedAsSludge_Method2", place: "inputs", key: "F_sludge" },
    { cell: "X_Cell_Wastewater_OutletCOD", place: "inputs", key: "COD_out" },
    // The workbook takes F_removed separately for each method
    { cell: "X_Cell_Wastewater_FractionCODRemovedAndTransferred_Method1", place: "inputs", key: "F_removed (Method 1)" },
    { cell: "X_Cell_Wastewater_FractionCODRemovedAndTransferred_Method2", place: "inputs", key: "F_removed (Method 2)" },
    { cell: "X_Cell_Wastewater_SludgeMethaneCapturedForCombustion", place: "inputs", key: "Q_cap" },
    { cell: "X_Cell_Wastewater_SludgeMethaneFlared", place: "inputs", key: "Q_flared" },
    { cell: "X_Cell_Wastewater_SludgeMethaneTransferred", place: "inputs", key: "Q_out" },
  ],
  tables: [],
};

const REC_FIELDS = [
  { field: "Description", key: "description" },
  { field: "Source", key: "source" },
  { field: "GenerationDate", key: "generation date" },
  { field: "NumberOfCertificates", key: "number of certificates" },
  // Calculated by the workbook; carried so conversion stays lossless
  { field: "MWh", key: "MWh" },
  { field: "Eligibility", key: "eligibility" },
];

export const ELECTRICITY: ModuleSpec = {
  test: "Electricity",
  section: "14 Scope 2 electricity",
  cells: [
    ...SITE_CELLS,
    { cell: "X_Cell_Site_EndDate", place: "site", key: "reporting period end date" },
    { cell: "X_Cell_Electricity_CalculationMethod", place: "workbook", key: "method shown" },
    { cell: "X_Cell_Electricity_Location_AmountPurchasedInkWh", place: "inputs", key: "Q_elec (location-based)" },
    { cell: "X_Cell_Electricity_Location_GridElectricityPurchasedFrom", place: "inputs", key: "grid electricity was purchased from g" },
    { cell: "X_Cell_Electricity_Market_AmountPurchasedExcludingGreenPower", place: "inputs", key: "Q_elec (market-based, excluding GreenPower)" },
    { cell: "X_Cell_Electricity_Market_RenewablePowerPercentage", place: "inputs", key: "RPP", percent: true },
    { cell: "X_Cell_Electricity_Market_JurisdictionalRenewablePowerPercentage", place: "inputs", key: "JRPP", percent: true },
    // Added to REC_surrendered (as MWh) by the workbook
    { cell: "X_Cell_Electricity_Market_AmountPurchasedGreenPower", place: "inputs", key: "GreenPower purchased (kWh)" },
  ],
  tables: [
    {
      kind: "rows",
      table: "Table_Input_RECSurrendered",
      place: "inputs",
      key: "RECs voluntarily surrendered",
      rowPrefix: "Row",
      props: { ...ROWS, AllowOverride: true },
      fields: REC_FIELDS,
    },
    {
      kind: "rows",
      table: "Table_Input_RECConsumedByEntity",
      place: "inputs",
      key: "RECs issued for electricity produced on-site and consumed",
      rowPrefix: "Row",
      props: ROWS,
      fields: REC_FIELDS,
    },
  ],
};
