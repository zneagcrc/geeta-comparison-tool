# Mapping decisions

An adapter translates a GEETA test scenario into your calculator's inputs, and your calculator's outputs back into
GEETA's result names. Every field it touches is a decision: is this the same quantity, in a different unit, under a
different name, worked out from something else, or not there at all? This document says how to make those decisions,
whether an LLM or a person writes the adapter, what evidence each one needs, and how to record it so a reviewer can
check it.

The rule underneath all of them: **an adapter translates; it doesn't calculate emissions.** A wrong translation looks
exactly like a calculator defect in the comparison, so each decision has to rest on what the two sides *define* a
field to mean, never on which choice makes the numbers match.

## 1. The evidence to read

Read the definitions on both sides before mapping anything. A field name alone is never enough: `AmountApplied` can
be a rate or a total, `Duration` can be days or months, a percentage can be 0-100 or 0-1.

| GEETA side | What it tells you |
|---|---|
| Input labels: `geeta-releases/<release>/InputFields/*_InputFields.json` (and the scenario docs, which show them) | The label, unit and cell type of every workbook input, e.g. `"AmountApplied": "Amount applied (t/hectare)"`, and whether a cell is entered (`number`, `select`) or worked out (`formula`) |
| Select options (same files, `Options`) | The full vocabulary of a categorical input, which every lookup has to cover |
| The neutral format: `npx geeta-compare neutral export <Test>`, [neutral-scenarios.md](neutral-scenarios.md) | The same inputs named in the methodology's terms (catalogue symbols or their descriptions) |
| The input catalogue: `catalogue/veerg-inputs.md` in this package | Each methodology input's symbol, description, unit and the equations that use it, e.g. `M_lime`: total mass of lime applied, kg, 5.3.1.1 (1) |
| The equations: `Modules/**/*_Equations.xlf` in the release | How an input is used: summed, multiplied by an area, split by class, ... |
| Workbook formulas: `tools/cellformula.py`, `tools/xlsxf.py` on the release's workbooks | What a formula cell (an area, a total, a split) is worked out from |
| Result names and units: `TestResults_*.json`, the scenario docs | What each expected result is, its equation number and its unit |

| Calculator side | What it tells you |
|---|---|
| Its input types or schema: the package's TypeScript types, an API's OpenAPI document (`geeta.lock.json` records where) | Field names, required fields, enumerations, units in descriptions |
| Its documentation | Units, defaults it applies, what an option means |
| Its output types | Which results it reports, in which unit, and per what (per gas, per class, totals) |

When the two definitions disagree or one is missing, that is itself a finding: note it (section 5) rather than
guessing quietly.

## 2. The kinds of mapping

Try them in this order: take the first one the evidence supports. The symbols are the ones the scenario docs' mapping
table uses when it traces what your adapter actually did.

### Direct (`=`)

The same quantity, in the same unit, with the same meaning: copy it.

- **Test:** both definitions describe the same thing (same object, same basis: per hectare, per head, per year, total)
  and the same unit.
- Example: GEETA's lime `AmountApplied`, "Amount applied (t/hectare)", and an API's `LimeApplicationRate` documented as
  "(t/ha)".
- **Not direct:** same name, different basis (a rate vs a total); same quantity, different period (annual vs per
  application); a field one side defines per class and the other for the whole farm.

### Unit or scale conversion (`÷1000`, `×1000`, `÷100`, `×100`, `as %`)

The same quantity in a different unit or scale, converted by a **fixed, definitional factor**.

- **Allowed:** L ↔ kL, kg ↔ t, g ↔ kg, kWh ↔ MWh, ha ↔ m², a percentage ↔ a fraction (`50%` or `50` ↔ `0.5`).
- **Not a unit conversion:** anything that needs data: litres to GJ (energy content), litres to kg (density), dry to
  wet matter (moisture content), N in product to product mass (N content), head to liveweight. Those are calculations
  with methodology parameters and belong to the calculator (section 3).
- **Check how percentages arrive:** a workbook percentage cell can come through as `"50%"`, `50` or `0.5`. Read the
  value in the neutral scenario, and what the calculator expects (0-100 or 0-1).

### Vocabulary lookup (`↦`)

A categorical value (a fuel type, a state, a manure system, an irrigation method, a product type) written in the
calculator's vocabulary.

- **Build the table from GEETA's full option list** (its `Options`), not only the values the test scenarios happen
  to use, so the adapter handles every value it can receive.
- Each GEETA value maps to **exactly one** calculator value, or to "no equivalent" (section 2, "No equivalent").
- **Many to one is fine** when the methodology treats the GEETA values the same (two vehicle classes with the same
  factors). **One to many** needs a rule from other inputs (a fuel use that becomes a different vehicle type depending
  on the fuel); without one, it is ambiguous.
- **Match on meaning, not spelling.** `Drip irrigation` ↔ `drip` is the same option; `Lime` ↔ `Limestone` may not be (a
  "lime" product can be part dolomite).
- **Never pick "the closest" option** for a value with no equivalent: a nearest-neighbour mapping hides a coverage gap
  and makes the result wrong in a way the comparison can't show.

### Reshape

The same data in a different structure: workbook rows to a list of objects, per-class columns to an array of classes,
a nested enterprise into the calculator's sections, one row per month into a monthly array. Each field inside is still
mapped by one of the other kinds; reshaping adds no meaning. Check that **every row arrives** (empty rows, rows with
zero amounts, and rows with a type the calculator lacks are each a decision: drop, keep as zero, or note).

### Combine or split

- **Combining** (summing rows or classes into one input the calculator takes) is a translation only when the
  methodology's equation is linear in that input and applies the same factors to every part. Summing fuel amounts of the
  same fuel type and use is fine; summing two fertiliser products with different N contents is not.
- **Splitting** a total into parts (by class, by month, by system) needs the shares as GEETA inputs. Never invent
  shares, and never split evenly unless the methodology says so.

### Derived (`ƒ`)

The calculator needs a quantity GEETA doesn't hold directly, but it follows from GEETA's inputs by a **definition**:
arithmetic that holds regardless of the methodology's data.

- **Allowed:** an amount from a rate and an area (`t/ha × ha = t`); a total from a quantity and a count
  (`head × days = head-days`); a duration from two dates; a remainder from shares that must sum to one
  (`dolomite fraction = 1 − limestone fraction`, *if* the definitions say the product is only those two); a per-hectare
  rate from a total and its area.
- **Write the formula and its basis** in the adapter's mapping record (section 5): which definition or label makes it
  true.
- **Formula cells:** when a GEETA value you need is a workbook formula (its `CellType` is `formula`, like the lime
  `ApplicationArea`), read the formula to see what it is worked out from, and derive it the same way from the inputs.
  Don't take the workbook's computed value as an input: it is GEETA's calculation, not the user's data.
- **Not derived:** anything that uses an emission factor, a GWP, an equation of the methodology, or a lookup in the
  methodology's data tables (section 3).

### Calculator default

The calculator wants an input that GEETA's scenario doesn't have.

- If the calculator applies its own default when the input is absent, **leave it absent** and say so in a note: the
  default is part of what is being compared.
- If it requires a value, use the value the **methodology** gives as the default for that situation (cite the clause),
  or a neutral one the calculator documents (zero for "none purchased"). Note it either way.
- Never take the value from GEETA's intermediate results or expected results.

### No equivalent (left out, with a note)

A GEETA input, option or row the calculator can't represent. Leave it out and print a note naming it and why:

```ts
console.warn(`Fuel row 4: fuel type "Fuel oil" has no equivalent in Acme (left out)`);
```

The results it affects will differ from GEETA's; the note is what the explanation ("<name> coverage gap") cites.
Leaving an input out with a note is a correct mapping. Approximating it is not.

### Ambiguous (an assumption, flagged)

Two readings fit the evidence and the definitions don't settle it, e.g. whether an API's `FracLime` on a `Limestone`
product means "the limestone share of a lime product" (the rest dolomite) or something else.

1. Look further first: the calculator's documentation, its schema descriptions, the methodology clause that defines
   the input, an example request in its docs, a question to its developers.
2. If it stays open, choose the reading the definitions support best, **write it as an assumption** in the mapping
   record and as a note (`console.warn("Assumed: FracLime is the limestone share of the product; ...")`), and say so
   when reporting the adapter.
3. Never settle it by trying both and keeping the one that matches GEETA. If the comparison later shows the assumption
   was wrong, the difference is recorded as an `Adapter defect` and the adapter is corrected: that is the honest
   outcome.

## 3. Where translating stops and calculating starts

An adapter must not do the calculator's work, or the comparison stops testing the calculator. The test: **does the
step need a number that comes from the methodology or its data?**

| Translation (the adapter does it) | Calculation (the calculator does it) |
|---|---|
| L → kL, % → fraction, kg → t | L → GJ (energy content), L → kg (density) |
| rate × area, head × days, dates → days | Emission factors, GWPs, conversion constants (44/28, 1.57, ...) |
| A state name to the calculator's state code | Looking up a factor by state |
| Summing rows the equation treats alike | Choosing a method (1 or 2) or a default row the methodology prescribes |
| Gas tonnes ÷ 1000 to match units | Gas tonnes × GWP to give CO2e |

**CO2e results:** when GEETA expects a CO2e result and the calculator reports only gas amounts, don't multiply by a GWP
in the adapter. Return the CO2e result only if the calculator reports it; otherwise leave it out ("not calculated"),
which the comparison reports as such.

The one exception is a `PROBE:<result>` value, written while explaining a difference: it recomputes a result with a
suspected cause corrected, and may use methodology numbers to do so, because it tests an explanation rather than
standing in for the calculator.

## 4. Mapping the results back

The same kinds apply in the other direction, from the calculator's outputs to GEETA's result names.

- **Identify each GEETA result** by its name, which carries the equation number (`VEERG_5_3_1_1__1_...` is 5.3.1.1
  equation (1)), the gas or CO2e, and the method (`_Method1`, `_Method2`, or none). Match the calculator's output that
  computes **that** equation for **that** gas and method.
- **Units:** fixed conversions only (kg → t). GEETA's units are in the expected results and the scenario docs.
- **Totals:** return a sum of the calculator's outputs as a GEETA total only when GEETA defines that result as that
  sum (the equation shows it). A total the calculator reports itself is better: it tests the calculator's own sum.
- **Methods:** if the calculator implements one method, return it under that method's names only. Don't copy a
  Method 1 result into a Method 2 name.
- **What it doesn't report:** leave the name out. "Not calculated" is an honest result; a zero is a claim.
- **Partial adapters:** when the adapter (or the endpoint it calls) covers only some modules, set `covers` so the rest
  isn't counted against the calculator.

## 5. Recording the decisions

Decisions are recorded in two places, by what they are.

**Choices go in `mapping.json`** (beside the plug-in; README.md, "Mapping decisions as data"): vocabulary lookups
(`lookups`, with `"to": null` for no equivalent), calculator defaults (`defaults`) and readings of ambiguous
definitions (`assumptions`). They are the provider's to make, so they are data the provider can change without
touching code, and each says who made it:

- `"by": "provider"`: decided by the calculator's provider. Final: an LLM never changes or removes one.
- `"by": "proposed"`: a draft (an LLM's first version, or a person's), shown as such in the run output and the docs
  until the provider keeps it (`"provider"`), changes it or removes it. `npx geeta-compare mapping --check` fails while
  any remain.

Adapters read them with `mapping("<id>")`: `m.lookup(table, value)`, `m.default(field)`, `m.assumption(key)`. A value or
field with no entry is a gap: the input is left out with a note and `geeta-compare mapping` lists it. Give a lookup
table its GEETA field (`"geeta": "Table.Column"` or an `X_Cell_...` name) so every option of the field is checked,
not only those the scenarios use. Write the evidence for each choice in its `reason`.

**Everything else goes in a mapping record at the top of the adapter**: direct copies, unit conversions, reshaping,
combining or splitting, and derived values. They follow from the definitions rather than anyone's choice, so they
live with the code that does them. One line per input and result the adapter handles, with the kind and the evidence;
for a choice, the line points at its `mapping.json` entry. It is what a reviewer checks, and what an explanation cites
when a difference turns out to be a mapping question.

```ts
// Mapping: Enterprises.CroppingGrains, 5.3 Lime (GEETA Table_Input_Lime -> POST enterprise-croppinggrains)
// | GEETA (neutral) input            | Calculator input                  | Kind | Basis                                              |
// | lime AmountApplied (t/hectare)   | limeApplications[].LimeApplicationRate | =  | both t/ha (InputFields label; schema description)  |
// | lime ApplicationArea (ha)        | limeApplications[].LimeApplicationArea | ƒ  | workbook formula: <what it reads>; derived the same way |
// | lime ProductType Lime / Gypsum   | ProductType Limestone / Gypsum    | ↦    | mapping.json lookups["lime product type"]          |
// | lime PercentOfLimestoneInLime    | FracLime                          | ÷100 | catalogue FracLime: fraction of lime as limestone  |
// | Assumed: a Lime product is limestone + dolomite; FracLime carries the split: mapping.json assumptions["lime FracLime"] |
// | Result 5.3.1.1 (1) CO2           | results.Fertiliser.E_lime (t CO2) | =    | equation 5.3.1.1 (1) in the response              |
```

Then check it against what the adapter really does: with the plug-in's `captureInputs`, the scenario docs' mapping
table traces each neutral input to the calculator inputs it reached, with the kind it found (`=`, `÷1000`, `↦`, `ƒ`).
A record that says `=` where the trace says `ƒ`, or an input the record maps that the trace shows as "Not used", is a
mistake in one of them.

## 6. The procedure, input by input

For each GEETA input of the test (the neutral scenario's fields, in order), and then for each expected result:

1. Read its definition on the GEETA side (label, unit, cell type, options, catalogue entry, the equations using it).
2. Find the calculator input with the same meaning (not the same name); read its definition and unit.
3. Take the first kind of mapping in section 2 the evidence supports; for a lookup, cover every GEETA option.
4. If none fits: is it a calculator default (section 2), no equivalent (note it), or ambiguous (assume, note, flag)?
5. Check the boundary (section 3): if the step needs a methodology number, it isn't the adapter's to do.
6. Record it: a choice (lookup, default, assumption) as a `mapping.json` entry with its reason, anything else as a
   line in the adapter's mapping record, with the basis. An LLM writes its choices as `"proposed"`.
7. After running the test, compare the record with the docs' mapping trace, and resolve every disagreement before
   explaining any difference.

Then look the other way: every **required** calculator input must be filled by a mapping, a default or a note, and
every GEETA input must appear in the record, mapped or explicitly left out.
