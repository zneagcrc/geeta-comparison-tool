// Neutral spec for an enterprise's production and allocation inputs: the production cycle, what it produced and sold,
// and the shares used to allocate emissions to its products (by income). No module test or methodology chapter defines
// them, so names follow the workbook's InputFields labels, with their units. Used for the enterprise tests only
// (src/neutral/enterprise.ts).
import { type CellSpec, type ModuleSpec, SITE_CELLS } from "../engine";

const ROWS = { MatrixType: "RowsToCols", ColumnOffset: 0, RowOffset: null };

const share = (cell: string, key: string): CellSpec => ({ cell, place: "inputs", key, percent: true });
const amount = (cell: string, key: string): CellSpec => ({ cell, place: "inputs", key });

export const ENTERPRISE_PRODUCTION: ModuleSpec = {
  test: "EnterpriseProduction",
  section: "Enterprise production and allocation",
  cells: [
    ...SITE_CELLS,
    // Excel date serial numbers, as the workbook holds them
    amount("X_Cell_Enterprise_ProductionTimeframeStart", "production cycle start (Excel date)"),
    amount("X_Cell_Enterprise_ProductionTimeframeEnd", "production cycle end (Excel date)"),
    // Products
    amount("X_Cell_Enterprise_ManureProduced", "manure produced (t)"),
    share("X_Cell_Enterprise_PercentManureSold", "fraction of manure sold"),
    share("X_Cell_Enterprise_PercentManureFertiliserOwnFarm", "fraction of manure used as fertiliser on own farm"),
    amount("X_Cell_Enterprise_EggsProduced", "eggs sold (t)"),
    share("X_Cell_Enterprise_PercentGrainSold", "fraction of grain sold"),
    share("X_Cell_Enterprise_PercentGrainUsedAsFeed", "fraction of grain used as feed on own farm"),
    share("X_Cell_PercentBaledHaySold", "fraction of baled hay/silage sold"),
    share("X_Cell_PercentBaledHayUsedOnFarm", "fraction of baled hay/silage used as feed on own farm"),
    share("X_Cell_Enterprise_PercentCottonLintSold", "fraction of cotton lint sold"),
    share("X_Cell_Enterprise_PercentCottonseedSold", "fraction of cottonseed sold"),
    // Cotton harvest: the crop (lint and cottonseed) is calculated from these
    amount("X_Cell_Crop_TotalRoundModules", "total round modules"),
    amount("X_Cell_Crop_AverageWeightPerRoundModule", "average weight per round module (kg)"),
    share("X_Cell_Crop_TurnoutRate", "turnout rate"),
    amount("X_Cell_Crop_WeightPerLintBale", "average weight per lint bale (kg)"),
    amount("X_Cell_Crop_CottonSeedAmountPerRoundModule", "cottonseed per round module (kg)"),
    share("X_Cell_Crop_PercentResidueBaled", "fraction of residue baled"),
    // The workbook marks it "Not used for cotton - do not edit"
    share("X_Cell_Crop_PercentResidueGrazed", "fraction of residue grazed (default, not used for cotton)"),
    // Allocation by income
    // The dairy workbook's cell for the same share (one neutral key can't write either of two cells)
    share("X_Cell_Enterprise_PercentIncomeFromLiveweight", "fraction of income from liveweight sold (dairy workbook)"),
    share("X_Cell_Enterprise_PercentIncomeFromLiveweightSold", "fraction of income from liveweight sold"),
    share("X_Cell_Enterprise_PercentIncomeFromMilk", "fraction of income from milk sold"),
    share("X_Cell_Enterprise_PercentIncomeFromWool", "fraction of income from wool sold"),
    share("X_Cell_Enterprise_PercentIncomeFromManureSold", "fraction of income from manure sold"),
    share("X_Cell_Enterprise_PercentIncomeFromBirdsSold", "fraction of income from birds sold"),
    share("X_Cell_Enterprise_PercentIncomeFromEggsSold", "fraction of income from eggs sold"),
    share("X_Cell_Enterprise_PercentIncomeFromGrain", "fraction of income from grain sold"),
    share("X_Cell_Enterprise_PercentIncomeFromBaledHaySilage", "fraction of income from baled hay/silage sold"),
    share("X_Cell_Enterprise_PercentIncomeFromCottonLint", "fraction of income from cotton lint sold"),
    share("X_Cell_Enterprise_PercentIncomeFromCottonseed", "fraction of income from cottonseed sold"),
  ],
  tables: [
    {
      kind: "rows",
      table: "Table_Input_LivestockSales",
      place: "inputs",
      key: "livestock sold",
      rowPrefix: "Row",
      props: ROWS,
      fields: [
        { field: "TransactionName", key: "transaction" },
        { field: "Class", key: "class" },
        { field: "SaleDate", key: "sale date" },
        { field: "HeadSold", key: "head sold" },
        { field: "AverageWeightPerHead", key: "average weight per head (kg)" },
        { field: "TotalLiveweightSold", key: "total liveweight sold (kg, calculated by the workbook)" },
        { field: "Maturity", key: "maturity (calculated by the workbook)" },
      ],
    },
  ],
};
