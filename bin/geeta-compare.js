#!/usr/bin/env node
// geeta-compare <command> [arguments]: runs a geeta-comparison-tool command (TypeScript, through tsx) in the calculator
// workspace it is started in (the folder with geeta.config.json, or above it; GEETA_WORKSPACE overrides).
"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const COMMANDS = {
  init: ["src/init.ts", "Set up a calculator workspace here: geeta-compare init <id> [\"<Name>\"]"],
  fetch: ["src/geeta-fetch.ts", "Download the GEETA release pinned in geeta.config.json (or the one named)"],
  test: ["src/run-veerg-tests.ts", "Compare the calculator with GEETA: every test, or the tests and scenarios named"],
  docs: ["src/docs/export.ts", "Write the scenario docs (HTML and Markdown) to the calculator's docsDir"],
  explain: ["src/explain/cli.ts", "Explanations: status, bundle, history, add (see README.md)"],
  neutral: ["src/neutral/cli.ts", "Neutral scenario format: check, export, to-veerg, run"],
  baseline: ["src/neutral/baseline.ts", "Adapter regression baseline: compare, save"],
};

const [command, ...args] = process.argv.slice(2);
if (!command || command === "help" || command === "--help" || !COMMANDS[command]) {
  if (command && !["help", "--help"].includes(command)) console.error(`Unknown command "${command}".\n`);
  console.log("Usage: geeta-compare <command> [arguments] [--calculator <id>]\n");
  for (const [name, [, about]] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(9)} ${about}`);
  process.exit(command && !["help", "--help"].includes(command) ? 1 : 0);
}

const entry = path.join(__dirname, "..", COMMANDS[command][0]);
const tsx = require.resolve("tsx/cli");
const result = spawnSync(process.execPath, [tsx, entry, ...args], { stdio: "inherit" });
process.exit(result.status ?? 1);
