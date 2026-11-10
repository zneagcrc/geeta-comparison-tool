# Neutral scenarios

Scenarios written in the methodology's own terms, so one file drives both the GEETA workbook and your
calculator. Every test has a neutral format: the module tests, the Scope 3 test and the enterprise tests. One folder per
test, one file per fixture scenario, exported from the workbook test fixtures.

| Folder | Section | Folder | Section |
|---|---|---|---|
| `3.1-enteric-feedlot` | 3.1 Beef feedlot | `4.6-poultry` | 4.6 Poultry |
| `3.2-enteric-beef` | 3.2 Pasture beef | `5-fertiliser` | 5 Fertiliser and lime |
| `3.3-enteric-dairy` | 3.3 Dairy | `6-residues` | 6 Crop and pasture residues |
| `3.4-enteric-sheep` | 3.4 Sheep | `7-rice` | 7 Rice cultivation |
| `3.5-enteric-pigs` | 3.5 Pigs | `8-fuel` | 8 Fuel use |
| `4.1-manure-feedlot` | 4.1 Beef feedlot | `9-refrigerants` | 9 Refrigerant use |
| `4.2-manure-beef` | 4.2 Pasture beef | `10-solid-waste` | 10 Solid waste |
| `4.3-manure-dairy` | 4.3 Dairy | `11-wastewater` | 11 Wastewater treatment |
| `4.4-manure-sheep` | 4.4 Sheep | `12-supplementary-co2` | 12 Supplementary CO2 |
| `4.5-manure-pigs` | 4.5 Pigs | `14-electricity` | 14 Scope 2 electricity |
|  |  | `15-scope3` | 15 Scope 3 (15.1-15.9, 15.12, 15.13, with chapter 8 fuel) |

### Enterprises

| Folder | Section |
|---|---|
| `enterprise-pasture-beef`, `enterprise-dairy`, `enterprise-sheep`, `enterprise-feedlot`, `enterprise-pigs`, `enterprise-poultry` | Enterprise: Pasture beef, Dairy, Sheep, Beef feedlot, Pigs, Poultry |
| `enterprise-cropping-grains`, `enterprise-cropping-cotton`, `enterprise-environmental-plantings` | Enterprise: Grains, Cotton, Environmental plantings |

An enterprise file is made of the module formats (`src/neutral/enterprise.ts`): one part per module under `modules`, by
the module's section, sharing one `site`. Each workbook field belongs to exactly one part. Three formats exist for the
enterprises only:

- `16 Land use change and forestry` (`src/neutral/modules/lulucf.ts`): plantings (revegetation by planting, j = 4),
  land clearing (j = 1-3) of plantings and of other vegetation, and the plantings and clearing assigned to an
  enterprise and its products. Names from Chapter 16 v1.0.
- `Enterprise production and allocation` (`src/neutral/modules/enterprise-production.ts`): production cycle, products
  (manure, eggs, grain, hay, cotton lint and seed, and cotton's round-module harvest), livestock sold, and the income
  shares used to allocate emissions to products. Names from the workbook's labels.
- `Data quality` (`src/neutral/modules/data-quality.ts`): temporal representativeness, spatial resolution and sample
  size per input group (Common Requirements Framework).

Values the workbook calculates (formula cells) say so in their name, or, for the poultry Method 1 diet and stage 2
direct application tables the poultry format leaves out, sit under `workbook.calculated`. Anything no format covers
would sit under `workbook` (`cells`, `tables`); none does now.

## Format

```jsonc
{
  "section": "4.5 Pigs",
  "scenario": { "name": "...", "description": "...", "notes": { } },
  "site": { "state": "Victoria", "mean annual temperature": 18, "location in leaching zone": true },
  "inputs": {                                   // the activity data a user records
    "N_j": { "1 = Boars": 100 },                // symbol from the catalogue; members as the documents write them
    "MMS_jmT1": { "1 = Boars": { "1 = Anaerobic lagoon": 0.15 } },
    "manure destinations": { "sold": { "1 = Anaerobic lagoon": { "13 = Direct application": 0.25 } } },
    "irrigation method ir": "Sprinkler Irrigation"
  },
  "workbook": { "farm name": "...", "Method 1 default manure production": { } }   // not methodology inputs
}
```

- **Activity data, in the documents' terms.** `inputs` holds what the user records. Where an input goes straight into
  an equation it is keyed by the catalogue symbol (`catalogue/veerg-inputs.md`, from the `.xlf` equation files:
  `N_j`, `D_j`, `I_j`, `MMS_jmT1`, `W_t`, `Q_elec`, `FracLime`, ...). Inputs the workbook derives an equation input from
  (fuel purchases and the fraction consumed, fertiliser products and their ingredients, REC rows, monthly calving
  percentages) are kept as recorded, named with the chapter's wording. Single-letter subscripts are keyed by their
  description (`"irrigation method ir"`, `"fuel type q"`), because the letters are reused between equations.
- **Dimension members** are written as the pre-release accepted documents write them, code included: classes and
  manure management systems from the chapter 3 and 4 subscript tables (`"5a = Cows 2-3 years"`,
  `"7 = Digestor/Covered lagoon"`), table members from Appendix A (`"Composting"`, `"Unmanaged - deep"`,
  `"Straw incorporated shortly (<30 days) before cultivation"`). Time periods are kept as the workbook labels them
  (`"Spring"`, `"January 2025"`).
- **Methods.** Inputs the workbook takes separately for each method carry the method in the key
  (`"F_removed (Method 1)"`, `"N_jkl (Method 2, months)"`). Method 2 farm data otherwise uses the plain symbol (`I_j`,
  `VS_j`).
- **Fractions are 0-1** where the workbook takes a percentage string ("20%"). Values the workbook takes as whole per
  cent stay as numbers, with "(per cent)" in the key.
- **`site`** holds the site records the workbook derives climate zone, rainfall region etc. from.
- **`workbook`** holds what isn't a methodology input: front-end conveniences (farm name, the dairy production system
  template), the workbook's Method 1 lookup tables (Appendix A defaults, filled in by formulas), and columns the
  workbook calculates (marked "(calculated by the workbook)"). They are kept so conversion is lossless.
- Poultry (the pilot) differs in one respect: its manure destinations are in `workbook` and `PF` in `inputs`.

## Tools

```
npx geeta-compare neutral export [Test ...]          # neutral files from the fixtures (all modules if none given)
npx geeta-compare neutral check [Test ...]           # fixture -> neutral -> fixture -> neutral, for every scenario
npx geeta-compare neutral to-veerg <file.json>       # the workbook test scenario for a neutral file
npx geeta-compare neutral run <file.json>            # VEERG results calculated with your calculator (neutralResults)
npx geeta-compare baseline compare [Test ...]        # adapters still give exactly the saved baseline
```

`check` passes when the round trip is lossless, your calculator's results from the regenerated scenario are identical, and no
workbook field is written differently (split tables are written back as the same blocks at the same offsets).

## Code

- `src/neutral/engine.ts`: the generic conversion, driven by a declarative spec per module. It refuses any workbook
  input a spec doesn't map, so nothing is dropped silently.
- `src/neutral/modules/`: the specs (`batch1.ts` chapters 8-14, `batch2.ts` chapters 5-7, `livestock.ts` chapters 3-4).
  `src/neutral/poultry.ts` is the pilot's own converter.
- `src/neutral/registry.ts`: every module's converter.
- Your plug-in: an adapter can calculate from a neutral scenario (its `neutralResults`), so the fixture adapter used by
  the test runner is `fromVeerg` followed by that, and `neutral run` works on neutral files you write yourself.
