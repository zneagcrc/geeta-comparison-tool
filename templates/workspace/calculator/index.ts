// {{name}}: the geeta-comparison-tool plug-in for this workspace (README.md in geeta-comparison-tool, "Writing a
// calculator plug-in"). Add one adapter per GEETA test: it takes the resolved test input for a scenario and returns
// {{name}}'s results keyed by the GEETA result names.
import type { Adapter, Calculator } from "geeta-comparison-tool/src/calculators/types";

/** Example: the Fuel test, from the neutral scenario (src/neutral/modules/batch1.ts, FUEL). Replace with your calculator. */
// import { fromVeerg } from "geeta-comparison-tool/src/neutral/engine";
// import { FUEL } from "geeta-comparison-tool/src/neutral/modules/batch1";
// const fuel: Adapter = (input) => {
//   const scenario = fromVeerg(FUEL, input);
//   const result = myCalculator.fuel(scenario);
//   return { VEERG_8_1_1__1_CarbonDioxideEmissionsFromTransportFuel_Result_Method1: result.co2Tonnes };
// };

const adapters: Record<string, Adapter> = {
  // Fuel: fuel,
};

const calculator: Calculator = {
  id: "{{id}}",
  name: "{{name}}",
  /** {{name}}'s version: part of every evidence fingerprint, so a new version marks explanations stale. */
  version: () => "0.0.0",
  adapters,
  adapterDir: "calculator",
  findings: "findings.md",
  docsDir: "docs/scenarios",
};

export default calculator;
