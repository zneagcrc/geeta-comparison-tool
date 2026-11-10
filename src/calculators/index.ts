// Calculator registry: the calculators listed in the workspace's geeta.config.json ("calculators", see config.ts).
// Every command compares one calculator with GEETA, chosen with `--calculator <id>` (anywhere on the command line,
// removed from process.argv before the command reads its own arguments), CALCULATOR=<id>, the config's "calculator",
// or the only one listed.
import fs from "node:fs";
import path from "node:path";
import type { Calculator, CalculatorPlugin } from "./types";
import { inWorkspace, workspaceConfig } from "../workspace";
import { calculatorEntry, lockedVersion } from "./config";

export const calculatorIds = Object.keys(workspaceConfig().calculators ?? {});

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

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

/** The calculator this run compares with GEETA: its plug-in, completed from its geeta.config.json entry and lock. */
export const calculator = (): Calculator => {
  if (selected) return selected;
  if (!calculatorIds.length)
    fail('No calculator defined yet: add one to "calculators" in geeta.config.json, then run: npx geeta-compare install <id>');
  if (!selectedId) fail(`Several calculators (${calculatorIds.join(", ")}): choose one with --calculator <id>`);
  if (!calculatorIds.includes(selectedId!)) fail(`Unknown calculator "${selectedId}" (geeta.config.json has: ${calculatorIds.join(", ")})`);
  const entry = calculatorEntry(selectedId!);
  const file = inWorkspace(entry.plugin);
  if (!fs.existsSync(file)) fail(`${entry.id}'s plug-in ${entry.plugin} doesn't exist yet: run npx geeta-compare install ${entry.id}`);
  const mod = require(file);
  const plugin: CalculatorPlugin | undefined = mod.default ?? mod.calculator;
  if (!plugin?.adapters) fail(`${entry.plugin} must default-export a calculator plug-in with "adapters" (README.md, "Writing a calculator plug-in")`);
  if (plugin!.id && plugin!.id !== entry.id) fail(`${entry.plugin} says its id is "${plugin!.id}", but geeta.config.json lists it as "${entry.id}"`);
  const version =
    plugin!.version ??
    (() => {
      const v = lockedVersion(entry.id) ?? (entry.kind === "none" || entry.kind === "api" ? entry.requested : undefined);
      if (!v) fail(`${entry.id} isn't installed yet: run npx geeta-compare install ${entry.id}`);
      return () => v!;
    })();
  return (selected = {
    ...plugin!,
    id: entry.id,
    name: plugin!.name ?? entry.name,
    version,
    adapterDir: plugin!.adapterDir ?? path.posix.dirname(entry.plugin.replace(/\\/g, "/")),
    findings: plugin!.findings ?? `findings/${entry.id}.md`,
    docsDir: plugin!.docsDir ?? `docs/${entry.id}`,
  });
};
