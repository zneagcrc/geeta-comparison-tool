// {{name}}: the geeta-comparison-tool plug-in for the calculator "{{id}}" in geeta.config.json, an HTTP API (README.md
// in geeta-comparison-tool, "Writing a calculator plug-in"). Add one adapter per GEETA test: it turns the resolved test
// input for a scenario into a request, sends it, and returns {{name}}'s results keyed by the GEETA result names
// (e.g. VEERG_5_3_1_1__1_LimeApplicationCO2Emissions_Result_Method1). The id, name and version come from geeta.config.json and geeta.lock.json.
{{using}}
import type { Adapter, CalculatorPlugin } from "geeta-comparison-tool/src/calculators/types";
import { apiClient } from "geeta-comparison-tool/src/http";
import { mapping } from "geeta-comparison-tool/src/mapping";

/** Requests go to the release URL in geeta.config.json, with the key from its apiKeyEnv (in .env). */
const api = apiClient("{{id}}");
/** Mapping decisions (code lookups, defaults, assumptions) from mapping.json beside this file: m.lookup(), m.default(), m.assumption(). */
const m = mapping("{{id}}");

// Example: one test sent to one endpoint.
// const croppingGrains: Adapter = (input) => {
//   const response = api.post("enterprise-croppinggrains", toRequest(input));   // GEETA test input -> the API's schema
//   return toGeetaResults(response);                                            // the API's results -> GEETA's names
// };

const adapters: Record<string, Adapter> = {
  // "Enterprises.CroppingGrains": croppingGrains,
};

/** captureInputs shows each request in the scenario docs. */
const plugin: CalculatorPlugin = { adapters, captureInputs: api.captureInputs };

export default plugin;
