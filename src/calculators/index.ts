// Calculator registry: the plug-ins listed in the workspace's geeta.config.json ("calculators": { id: module }). Every
// command compares one calculator with GEETA, chosen with `--calculator <id>` (anywhere on the command line, removed
// from process.argv before the command reads its own arguments), CALCULATOR=<id>, the config's "calculator", or the
// only one listed.
import type { Calculator } from "./types";
import { inWorkspace, workspaceConfig } from "../workspace";

const modules = () => workspaceConfig().calculators ?? {};

export const calculatorIds = Object.keys(modules());

const fromArgv = () => {
  const i = process.argv.findIndex((a) => a === "--calculator" || a.startsWith("--calculator="));
  if (i < 0) return undefined;
  const [flag, value] = process.argv[i].split("=");
  const id = value ?? process.argv[i + 1];
  process.argv.splice(i, value === undefined ? 2 : 1);
  if (flag !== "--calculator" || !id) throw new Error("Usage: --calculator <id>");
  return id;
};

const selectedId = fromArgv() ?? process.env.CALCULATOR ?? workspaceConfig().calculator ?? (calculatorIds.length === 1 ? calculatorIds[0] : undefined);
let selected: Calculator | undefined;

/** The calculator this run compares with GEETA, loaded on first use from its module in the workspace. */
export const calculator = (): Calculator => {
  if (selected) return selected;
  if (!calculatorIds.length) throw new Error('geeta.config.json lists no calculators: add "calculators": { "<id>": "<module>" }');
  if (!selectedId) throw new Error(`Several calculators (${calculatorIds.join(", ")}): choose one with --calculator <id>`);
  const spec = modules()[selectedId];
  if (!spec) throw new Error(`Unknown calculator "${selectedId}" (geeta.config.json has: ${calculatorIds.join(", ")})`);
  const mod = require(inWorkspace(spec));
  const plugin: Calculator | undefined = mod.default ?? mod.calculator;
  if (!plugin?.id) throw new Error(`${spec} must export a Calculator as its default export (see README.md, "Adding a calculator")`);
  if (plugin.id !== selectedId) throw new Error(`${spec} exports calculator "${plugin.id}", but geeta.config.json lists it as "${selectedId}"`);
  return (selected = plugin);
};
