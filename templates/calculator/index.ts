// {{name}}: the geeta-comparison-tool plug-in for the calculator "{{id}}" in geeta.config.json (README.md in
// geeta-comparison-tool, "Developing adapters"). Add one adapter per GEETA test: it takes the resolved test input for a
// scenario and returns {{name}}'s results keyed by the GEETA result names. The id, name and version come from
// geeta.config.json and geeta.lock.json (`geeta-compare install`), so the plug-in doesn't repeat them.
// Mapping decisions (code lookups, defaults, assumptions) live in mapping.json beside this file, not in the code:
// read them with m.lookup(), m.default() and m.assumption(). docs/mapping-decisions.md says how to make them.
{{using}}
import type { Adapter, CalculatorPlugin } from "geeta-comparison-tool/src/calculators/types";
import { mapping } from "geeta-comparison-tool/src/mapping";

const m = mapping("{{id}}");

// Example: the Fuel test, from the neutral scenario (activity data in the methodology's terms).
// import { moduleFor } from "geeta-comparison-tool/src/neutral/registry";
// const toNeutral = moduleFor("Fuel")!.fromVeerg;
// const fuel: Adapter = (input) => {
//   const { inputs } = toNeutral(input);
//   const purchases = [];
//   for (const p of inputs["fuel purchased"]) {
//     const type = m.lookup("fuel type q", p["fuel type q"]);   // mapping.json lookups["fuel type q"]; undefined: left out
//     if (type === undefined) continue;
//     purchases.push({ type, kilolitres: p["amount purchased"] / 1000 });
//   }
//   const result = calc.fuel({ purchases });
//   return { VEERG_8_1_1_1__1_FuelCombustionTransport_Result_CO2: result.transport.co2Tonnes };
// };

const adapters: Record<string, Adapter> = {
  // Fuel: fuel,
};

const plugin: CalculatorPlugin = { adapters };

export default plugin;
