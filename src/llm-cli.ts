// geeta-compare llm                       the LLM settings, and a check of the key and model (no tokens used)
// geeta-compare llm adapter <Test> [<Test> ...] | --all [--upgrade]
//                                         writes (or extends) the adapter of each test, as CLAUDE.md says: one agent
//                                         session per test, in order. --all: every test the plug-in has an adapter for.
//                                         --upgrade: adapts them to a new version of the calculator instead, from what
//                                         changed in its interface (src/calculators/interface.ts), keeping every decision
// geeta-compare llm explain <Test>[:<Scenario>]   builds the evidence bundle, then the agent explains the differences
// Hints from the provider, any number: hint:"Acme has no town gas" or --hint "...". Add --calculator <name or id>
// when the workspace has several calculators, and --agent ide (or claude-code) to choose the agent for this command.
// See src/llm.ts for the settings.
import Anthropic from "@anthropic-ai/sdk";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { calculator } from "./calculators";
import { calculatorEntry, readLock } from "./calculators/config";
import { interfaceDiff, snapshotInterface } from "./calculators/interface";
import { type AgentTask, claudeCodeVersion, llmConfig, llmKey, requireSupportedProvider, runAgent, writeAgentRequest } from "./llm";
import { writeBrief } from "./brief-cli";
import { WORKSPACE } from "./workspace";

// The subcommand comes first; `llm --agent ide` (flags only) is the settings check
const argv = process.argv.slice(2);
const command: string | undefined = argv[0]?.startsWith("--") ? undefined : argv[0];
const args: string[] = command === undefined ? argv : argv.slice(1);

// Hints: hint:"text" (the shell passes hint:text as one argument) or --hint "text", any number of either
const hints: string[] = [];
const rest: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("hint:")) hints.push(a.slice(5).trim());
  else if (a === "--hint" && i + 1 < args.length) hints.push(args[++i].trim());
  else if (a.startsWith("--hint=")) hints.push(a.slice(7).trim());
  else rest.push(a);
}
/** The tests named: arguments that aren't flags or a flag's value. */
const VALUED = new Set(["--calculator", "--agent"]);
const targets = rest.filter((a, i) => !a.startsWith("--") && !VALUED.has(rest[i - 1]));
const target = targets[0];
const rel = (f: string) => path.relative(WORKSPACE, f).replace(/\\/g, "/");

/** The hints as a prompt section: the provider's own statements, with what they may settle. */
const hintSection = () =>
  hints.filter(Boolean).length
    ? "\n\nHints from the calculator's provider (their statements about their calculator or how to map it; they take precedence over your own reading):\n" +
      hints
        .filter(Boolean)
        .map((h) => `- ${h}`)
        .join("\n") +
      "\nA mapping decision that follows directly from a hint is the provider's: record it in mapping.json with \"by\": \"provider\" and the hint as its reason (\"Hint: ...\"). " +
      "Everything you work out yourself stays \"proposed\". If a hint contradicts the calculator's code, types or documentation, follow the hint but say so in your report."
    : "";

const check = async () => {
  const c = llmConfig();
  if (c.agent === "ide") {
    console.log(
      'Agent:    the agent in your editor ("agent": "ide"). The llm commands write the task to .geeta/requests/ for it and nothing runs here, ' +
        "so there is no key or model to check: the editor's agent uses its own.",
    );
    return;
  }
  console.log(
    `Provider: ${c.provider}\nModel:    ${c.model}\nAuth:     ${c.auth === "key" ? `the key in ${c.apiKeyEnv} ${llmKey(c) ? "(set)" : "(not set)"}` : "Claude Code's own sign-in (the key isn't used)"}`,
  );
  const cc = claudeCodeVersion();
  console.log(`Agent:    ${cc ? `Claude Code ${cc}` : "Claude Code isn't installed here (npm install --save-dev @anthropic-ai/claude-code)"}`);
  requireSupportedProvider(c);
  if (c.auth === "sign-in") {
    console.log("\nauth is \"sign-in\": Claude Code's own sign-in is used, so there is no key to check here.");
    return;
  }
  const key = llmKey(c);
  if (!key) {
    console.log(`\n${c.apiKeyEnv} isn't set: put ${c.apiKeyEnv}=<key> in the workspace's .env (or set "auth": "sign-in" to use Claude Code's own sign-in).`);
    process.exitCode = 1;
    return;
  }
  // The Models API confirms the key and the model without generating anything
  const client = new Anthropic({ apiKey: key });
  try {
    const model = await client.models.retrieve(c.model);
    console.log(`\nOK: the key works, and ${model.display_name} (${model.id}) is available to it.`);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) console.error(`\nThe key in ${c.apiKeyEnv} was refused (HTTP 401).`);
    else if (error instanceof Anthropic.PermissionDeniedError) console.error(`\nThe key in ${c.apiKeyEnv} isn't allowed to use ${c.model} (HTTP 403).`);
    else if (error instanceof Anthropic.NotFoundError) console.error(`\nThe model "${c.model}" doesn't exist (HTTP 404): check llm.model in geeta.config.json.`);
    else if (error instanceof Anthropic.APIConnectionError) console.error(`\nCouldn't reach the Anthropic API: ${error.message}`);
    else if (error instanceof Anthropic.APIError) console.error(`\nAnthropic API error ${error.status}: ${error.message}`);
    else throw error;
    process.exitCode = 1;
  }
};

type Upgrade = { from?: string; to: string; diff?: string; note?: string };

/** The prompt for one test's adapter: written (or extended), or adapted to an upgrade; test `k` of the `all` in this run. */
const adapterPrompt = (test: string, k: number, all: string[], upgrade?: Upgrade) => {
  const calc = calculator();
  let brief = "";
  // An upgrade changes the calculator side only: it needs no brief
  if (!upgrade)
    try {
      brief =
        ` The test's brief, ${rel(writeBrief(test))}, has the GEETA side in one place (its inputs, where the workbook takes them, their labels, ` +
        "units and options, the VEERG definitions, the result names): start from it, and read the release's files only for what it leaves open.";
    } catch {
      // no brief for a test without an input file: the agent reads the release
    }
  const task = upgrade
    ? `${calc.name} (calculator "${calc.id}") was upgraded${upgrade.from ? ` from ${upgrade.from}` : ""} to ${upgrade.to}. Adapt its adapter for the GEETA ` +
      `test ${test} to the new version, following "Adapting to an upgrade" in CLAUDE.md: change only what the new version requires, keep every ` +
      "decision in mapping.json and everything else the adapter maps, and don't rewrite it. " +
      (upgrade.diff
        ? `What changed in the calculator's interface: ${upgrade.diff}.`
        : `No record of what changed in the calculator's interface was kept (${upgrade.note}): work it out from its types, documentation and changelog.`)
    : `Write the adapter for the GEETA test ${test} in the ${calc.name} plug-in (calculator "${calc.id}"), following "Writing an adapter" in CLAUDE.md. ` +
      'Propose your mapping decisions in mapping.json as "proposed"; never change a "provider" decision.' +
      brief;
  const shared =
    all.length < 2
      ? ""
      : k === 0
        ? ` This is the first of ${all.length} tests in this run (${all.join(", ")}): where the work needs plug-in code several adapters share, change it here, for all of them.`
        : ` The ${k === 1 ? "test" : `${k} tests`} before it in this run (${all[0]}${k > 1 ? ` to ${all[k - 1]}` : ""}) ${k === 1 ? "was" : "were"} done earlier, ` +
          `with any plug-in code the adapters share: build on it, and change it only where ${test} needs it, without breaking the others.`;
  return `${task}${shared} Finish with the report CLAUDE.md asks for.${hintSection()}`;
};

/** The calculator's upgrade: the version before this one (geeta.lock.json "previous") and what changed in its interface. */
const upgradeInfo = (): Upgrade => {
  const calc = calculator();
  const lock = readLock().calculators[calc.id];
  const to = lock?.version ?? calc.version();
  const from = lock?.previous;
  if (!from) return { to, note: "geeta.lock.json doesn't say which version came before: install records it from geeta-comparison-tool 0.3 on" };
  snapshotInterface(calculatorEntry(calc.id), to);
  const d = interfaceDiff(calc.id, from, to);
  return { from, to, diff: d.file && rel(d.file), note: d.note };
};

/** Runs the tasks: one Claude Code session each, in order, or one request for the agent in the editor. */
const runTasks = async (name: string, tasks: AgentTask[]) => {
  if (llmConfig().agent === "ide") {
    writeAgentRequest(name, `geeta-compare llm ${process.argv.slice(2).join(" ")}`, tasks);
    return 0;
  }
  const failed: string[] = [];
  for (const [k, t] of tasks.entries()) {
    if (tasks.length > 1) console.log(`\n=== ${k + 1}/${tasks.length}: ${t.title} ===`);
    if ((await runAgent(t.prompt)) !== 0) failed.push(t.title);
  }
  if (tasks.length > 1) console.log(`\n${tasks.length - failed.length} of ${tasks.length} done${failed.length ? `; ended with an error: ${failed.join(", ")}` : ""}.`);
  return failed.length ? 1 : 0;
};

const main = async () => {
  if (!command || command === "check") return check();
  const calc = calculator();
  for (const h of hints.filter(Boolean)) console.log(`Hint: ${h}`);
  if (command === "adapter") {
    const all = args.includes("--all") ? Object.keys(calc.adapters) : targets;
    if (!all.length) {
      console.error(
        args.includes("--all")
          ? `The ${calc.name} plug-in has no adapters yet: name the tests to write, e.g. geeta-compare llm adapter Fuel`
          : 'Usage: geeta-compare llm adapter <Test> [<Test> ...] | --all [--upgrade] [hint:"..." ...]',
      );
      process.exit(1);
    }
    const upgrade = args.includes("--upgrade") ? upgradeInfo() : undefined;
    if (upgrade)
      console.log(
        `Upgrade${upgrade.from ? ` from ${upgrade.from}` : ""} to ${upgrade.to}: ` +
          (upgrade.diff ? `interface changes in ${upgrade.diff}` : `no interface changes recorded (${upgrade.note})`),
      );
    const tasks = all.map((t, k) => ({ title: t, prompt: adapterPrompt(t, k, all, upgrade) }));
    process.exitCode = await runTasks(`${upgrade ? "upgrade" : "adapter"}-${all.length === 1 ? all[0] : `${all.length}-tests`}`, tasks);
    return;
  }
  if (!target) {
    console.error(`Usage: geeta-compare llm ${command} <Test>${command === "explain" ? "[:<Scenario>]" : ""} [hint:"..." ...]`);
    process.exit(1);
  }
  if (command === "explain") {
    // The bundle is built deterministically first; the agent works from it
    const explainCli = path.join(__dirname, "explain", "cli.ts");
    const tsx = require.resolve("tsx/cli");
    const b = spawnSync(process.execPath, [tsx, explainCli, "bundle", target, "--calculator", calc.id], { encoding: "utf8" });
    process.stdout.write(b.stdout ?? "");
    process.stderr.write(b.stderr ?? "");
    if (b.status !== 0) process.exit(b.status ?? 1);
    const file = (b.stdout ?? "").match(/^Wrote (.+\.md)\s*$/m)?.[1];
    if (!file) {
      console.error("The bundle command didn't say where it wrote the bundle.");
      process.exit(1);
    }
    const prompt =
      `Explain the differences in ${file}, following "Explaining differences" in CLAUDE.md (calculator "${calc.id}").` +
      (hints.filter(Boolean).length
        ? "\n\nHints from the calculator's provider (their statements; use them as leads and cite them as sources, but every explanation still needs its numeric check):\n" +
          hints
            .filter(Boolean)
            .map((h) => `- ${h}`)
            .join("\n")
        : "");
    process.exitCode = await runTasks(`explain-${target}`, [{ title: `explain ${target}`, prompt }]);
    return;
  }
  console.error(`Unknown: geeta-compare llm ${command} (use: llm, llm adapter <Test> ..., llm explain <Test>)`);
  process.exit(1);
};

main();
