// Neutral site block, shared by every module's neutral scenario. Holds the site records the methodology derives
// its context inputs from (climate zone, rainfall region and wet/dry zone come from these, as in the workbook's
// "Input - Site" sheet). Keys use the catalogue's terms where it has one (e.g. "mean annual temperature",
// "location in leaching zone"), otherwise the workbook's label.

export interface Site {
  /** d/m/yyyy, as the workbook takes it */
  "reporting period start date": string;
  state: string;
  /** ABS SA4 region (WA only) */
  region?: string | null;
  "location in leaching zone": boolean;
  /** m */
  elevation: number;
  /** °C, average for the reporting period */
  "mean annual temperature": number;
  /** mm for the reporting period */
  "total rainfall": number;
  /** mm for the reporting period */
  "potential evapotranspiration": number;
  "number of frost days": number;
}

const LEACHING = { yes: "YES - In leaching zone", no: "NO - Not in leaching zone" };

export const siteFromVeerg = (input: any): Site => ({
  "reporting period start date": input.X_Cell_Site_StartDate,
  state: input.X_Cell_Site_State,
  region: input.X_Cell_Site_Region ?? null,
  "location in leaching zone": String(input.X_Cell_Site_LeachingZone ?? "").startsWith("YES"),
  elevation: input.X_Cell_Site_Elevation,
  "mean annual temperature": input.X_Cell_Site_AverageTemperature,
  "total rainfall": input.X_Cell_Site_TotalRainfall,
  "potential evapotranspiration": input.X_Cell_Site_PotentialEvapotranspiration,
  "number of frost days": input.X_Cell_Site_FrostDays,
});

/** Workbook site cells (X_Cell_Site_*). Also what the adapters' site helpers in common.ts read. */
export const siteToVeerg = (site: Site) => ({
  X_Cell_Site_StartDate: site["reporting period start date"],
  X_Cell_Site_State: site.state,
  X_Cell_Site_Region: site.region ?? null,
  X_Cell_Site_LeachingZone: site["location in leaching zone"] ? LEACHING.yes : LEACHING.no,
  X_Cell_Site_Elevation: site.elevation,
  X_Cell_Site_AverageTemperature: site["mean annual temperature"],
  X_Cell_Site_TotalRainfall: site["total rainfall"],
  X_Cell_Site_PotentialEvapotranspiration: site["potential evapotranspiration"],
  X_Cell_Site_FrostDays: site["number of frost days"],
});
