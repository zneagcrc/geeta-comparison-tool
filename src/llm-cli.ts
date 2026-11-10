// geeta-compare llm                       the LLM settings, and a check of the key and model (no tokens used)
// geeta-compare llm adapter <Test>        Claude Code writes (or extends) the adapter for a test, as CLAUDE.md says
// geeta-compare llm explain <Test>[:<Scenario>]   builds the evidence bundle, then Claude Code explains the differences
// Hints from the provider, any number: hint:"Acme has no town gas" or --hint "...". Add --calculator <name or id>
// when the workspace has several calculators. See src/llm.ts for the settings.
import Anthropic from "@anthropic-ai/sdk";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { calculator } from "./calculators";
import { claudeCodeVersion, llmConfig, llmKey, requireSupportedProvider, runAgent } from "./llm";

const [command, ...args] = process.argv.slice(2);

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
const target = rest.find((a) => !a.startsWith("--"));

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

const main = async () => {
  if (!command || command === "check") return check();
  if (!target) {
    console.error(`Usage: geeta-compare llm ${command} <Test>${command === "explain" ? "[:<Scenario>]" : ""} [hint:"..." ...]`);
    process.exit(1);
  }
  const calc = calculator();
  for (const h of hints.filter(Boolean)) console.log(`Hint: ${h}`);
  if (command === "adapter") {
    process.exitCode = await runAgent(
      `Write the adapter for the GEETA test ${target} in the ${calc.name} plug-in (calculator "${calc.id}"), following "Writing an adapter" in CLAUDE.md. ` +
        `Propose your mapping decisions in mapping.json as "proposed"; never change a "provider" decision. Finish with the report CLAUDE.md asks for.` +
        hintSection(),
    );
    return;
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
    process.exitCode = await runAgent(
      `Explain the differences in ${file}, following "Explaining differences" in CLAUDE.md (calculator "${calc.id}").` +
        (hints.filter(Boolean).length
          ? "\n\nHints from the calculator's provider (their statements; use them as leads and cite them as sources, but every explanation still needs its numeric check):\n" +
            hints
              .filter(Boolean)
              .map((h) => `- ${h}`)
              .join("\n")
          : ""),
    );
    return;
  }
  console.error(`Unknown: geeta-compare llm ${command} (use: llm, llm adapter <Test>, llm explain <Test>)`);
  process.exit(1);
};

main();
