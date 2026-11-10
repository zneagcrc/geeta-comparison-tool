#!/usr/bin/env node
// geeta-compare <command> [arguments]: runs a geeta-comparison-tool command (TypeScript, through tsx) in the calculator
// workspace it is started in (the folder with geeta.config.json, or above it; GEETA_WORKSPACE overrides).
"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const COMMANDS = {
  init: ["src/init.ts", "Set up a comparison workspace here (no calculator yet)"],
  install: ["src/install.ts", "Install the calculators defined in geeta.config.json (all, or the ids named) and record their versions"],
  fetch: ["src/geeta-fetch.ts", "Download the GEETA release pinned in geeta.config.json (or the one named)"],
  test: ["src/run-veerg-tests.ts", "Compare the calculator with GEETA: every test, or the tests and scenarios named"],
  names: ["src/names-cli.ts", "The GEETA result names of a test, without their values (for writing adapters)"],
  docs: ["src/docs/export.ts", "Write the scenario docs (HTML and Markdown) to the calculator's docsDir; needs the mapping traced"],
  explain: ["src/explain/cli.ts", "Explanations: status, bundle, history, add (see README.md)"],
  neutral: ["src/neutral/cli.ts", "Neutral scenario format: check, export, to-veerg, run"],
  baseline: ["src/neutral/baseline.ts", "Adapter regression baseline: compare, save"],
  llm: ["src/llm-cli.ts", "The LLM (geeta.config.json llm, key in .env): check it; llm adapter <Test>; llm explain <Test>"],
  mapping: ["src/mapping-cli.ts", "Mapping decisions (mapping.json): gaps, undecided GEETA options, proposals; --check fails while any remain. mapping trace [Test ...]: trace the mapping for the docs"],
};

const [command, ...args] = process.argv.slice(2);
if (!command || command === "help" || command === "--help" || !COMMANDS[command]) {
  if (command && !["help", "--help"].includes(command)) console.error(`Unknown command "${command}".\n`);
  console.log("Usage: geeta-compare <command> [arguments] [--calculator <id>]\n");
  for (const [name, [, about]] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(9)} ${about}`);
  process.exit(command && !["help", "--help"].includes(command) ? 1 : 0);
}

// mapping trace: the docs' mapping trace (src/docs/trace-cli.ts)
const sub = command === "mapping" && args[0] === "trace";
const entry = path.join(__dirname, "..", sub ? "src/docs/trace-cli.ts" : COMMANDS[command][0]);
const tsx = require.resolve("tsx/cli");
const result = spawnSync(process.execPath, [tsx, entry, ...(sub ? args.slice(1) : args)], { stdio: "inherit" });
process.exit(result.status ?? 1);
