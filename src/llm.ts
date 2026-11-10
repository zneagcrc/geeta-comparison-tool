// The LLM a workspace uses for the steps that need one (writing adapters, explaining differences), set in
// geeta.config.json, with its key in the workspace's .env:
//
//   "llm": {
//     "provider": "anthropic",            // the provider (Anthropic only, for now)
//     "model": "claude-opus-5-5",         // the model the agent runs on
//     "apiKeyEnv": "ANTHROPIC_API_KEY",   // the environment variable (or .env entry) holding the key
//     "auth": "key"                       // "key": only that key is used (runs fail without it);
//                                         // "sign-in": Claude Code's own sign-in instead, the key is ignored
//   }
//
// Every field is optional: these are the defaults. With "key", Claude Code gets its own empty settings folder and the
// key through apiKeyHelper, so it never falls back to a sign-in it finds on the machine (it would otherwise prefer one).
// The LLM never runs in `test`, `docs`, `explain status/bundle/add` or `mapping`: only in `geeta-compare llm ...`.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { WORKSPACE, workspaceConfig } from "./workspace";

export const PROVIDERS = ["anthropic"] as const;
export type LlmConfig = { provider: string; model: string; apiKeyEnv: string; auth: "key" | "sign-in" };

export const DEFAULT_LLM: LlmConfig = { provider: "anthropic", model: "claude-opus-5-5", apiKeyEnv: "ANTHROPIC_API_KEY", auth: "key" };

/** The workspace's LLM settings, with the defaults filled in. */
export const llmConfig = (): LlmConfig => {
  const c = (workspaceConfig() as { llm?: Partial<LlmConfig> }).llm ?? {};
  if (c.auth !== undefined && c.auth !== "key" && c.auth !== "sign-in") {
    console.error(`geeta.config.json llm.auth must be "key" or "sign-in" (it is "${c.auth}")`);
    process.exit(1);
  }
  return {
    provider: c.provider ?? DEFAULT_LLM.provider,
    model: c.model ?? DEFAULT_LLM.model,
    apiKeyEnv: c.apiKeyEnv ?? DEFAULT_LLM.apiKeyEnv,
    auth: c.auth ?? DEFAULT_LLM.auth,
  };
};

/** The key, from the environment variable (or .env entry) the config names; undefined if it isn't set. */
export const llmKey = (c = llmConfig()): string | undefined => process.env[c.apiKeyEnv] || undefined;

/** Fails with a plain message when the provider isn't one this version can run. */
export const requireSupportedProvider = (c = llmConfig()) => {
  if ((PROVIDERS as readonly string[]).includes(c.provider)) return;
  console.error(`geeta.config.json llm.provider "${c.provider}" isn't supported yet (supported: ${PROVIDERS.join(", ")}).`);
  process.exit(1);
};

/** Claude Code's executable in the workspace (the @anthropic-ai/claude-code package's bin), or undefined. */
const claudeBin = (): string | undefined => {
  try {
    const pkgFile = require.resolve("@anthropic-ai/claude-code/package.json", { paths: [WORKSPACE] });
    const bin = JSON.parse(fs.readFileSync(pkgFile, "utf8")).bin;
    const rel = typeof bin === "string" ? bin : bin?.claude;
    const file = rel && path.join(path.dirname(pkgFile), rel);
    return file && fs.existsSync(file) ? file : undefined;
  } catch {
    return undefined;
  }
};

/** The Claude Code version installed in the workspace, or undefined. */
export const claudeCodeVersion = (): string | undefined => {
  const bin = claudeBin();
  if (!bin) return undefined;
  const r = spawnSync(bin, ["--version"], { cwd: WORKSPACE, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim().split(/\r?\n/)[0] : undefined;
};

/** The tools the agent has: reading, searching and editing files, and a shell (Bash, or PowerShell on Windows). */
const TOOLS = ["Read", "Edit", "Write", "Glob", "Grep", "Bash", "PowerShell"];
/** What it may do without asking (it can't ask, running non-interactively): edit files, and run these commands only. */
const ALLOWED = [
  "Read",
  "Edit",
  "Write",
  "Glob",
  "Grep",
  // This tool's commands, the workspace's scripts, and the Python workbook tools that ship with this package
  ...["npx geeta-compare *", "npm run *", "python -I node_modules/geeta-comparison-tool/tools/*", "py -I node_modules/geeta-comparison-tool/tools/*"].flatMap(
    (c) => [`Bash(${c})`, `PowerShell(${c})`],
  ),
];

const elapsed = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};
const short = (s: string, n = 160) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};

/** One line for a tool the agent used. */
const describeTool = (name: string, input: any): string => {
  const file = (p: unknown) => (typeof p === "string" ? path.relative(WORKSPACE, p).replace(/\\/g, "/") || p : "");
  switch (name) {
    case "Read":
      return `Read ${file(input?.file_path)}`;
    case "Edit":
      return `Edit ${file(input?.file_path)}`;
    case "Write":
      return `Write ${file(input?.file_path)}`;
    case "Glob":
      return `Find files ${input?.pattern ?? ""}`;
    case "Grep":
      return `Search for ${short(String(input?.pattern ?? ""), 60)}${input?.path ? ` in ${file(input.path)}` : ""}`;
    case "Bash":
    case "PowerShell":
      return `Run: ${short(String(input?.command ?? ""), 140)}`;
    default:
      return name;
  }
};

/**
 * Runs Claude Code non-interactively in the workspace on the configured model, with `prompt` as the task, printing its
 * progress as it goes. The workspace's CLAUDE.md gives it the rules; it may only edit files and run geeta-compare and
 * npm scripts. With "auth": "key", the key is the only credential it can use: it gets an empty Claude Code settings
 * folder of its own (so no sign-in is found) and the key through apiKeyHelper, and the run is stopped before its first
 * request if Claude Code reports any other credential. Resolves to Claude Code's exit status.
 */
export const runAgent = async (prompt: string): Promise<number> => {
  const c = llmConfig();
  requireSupportedProvider(c);
  const bin = claudeBin();
  if (!bin) {
    console.error("Claude Code isn't installed in this workspace: npm install --save-dev @anthropic-ai/claude-code");
    process.exit(1);
  }
  const key = llmKey(c);
  if (c.auth === "key" && !key) {
    console.error(
      `${c.apiKeyEnv} isn't set: put ${c.apiKeyEnv}=<key> in the workspace's .env (or set "auth": "sign-in" in geeta.config.json llm to use Claude Code's own sign-in).`,
    );
    process.exit(1);
  }

  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  const args = ["-p", prompt, "--model", c.model, "--tools", TOOLS.join(","), "--allowedTools", ALLOWED.join(","), "--permission-mode", "acceptEdits", "--output-format", "stream-json", "--verbose"];
  if (c.auth === "key") {
    // Its own settings folder (no sign-in to find), and the key from an environment variable via apiKeyHelper (the key
    // never appears on a command line or in a file)
    const configDir = path.join(os.tmpdir(), "geeta-compare-claude", crypto.createHash("sha256").update(WORKSPACE).digest("hex").slice(0, 12));
    fs.mkdirSync(configDir, { recursive: true });
    const settings = path.join(configDir, "geeta-settings.json");
    fs.writeFileSync(settings, JSON.stringify({ apiKeyHelper: `"${process.execPath}" -e "process.stdout.write(process.env.GEETA_LLM_KEY||'')"` }));
    env.CLAUDE_CONFIG_DIR = configDir;
    env.GEETA_LLM_KEY = key;
    args.push("--settings", settings);
  }

  console.log(`Claude Code (${c.model}) in ${WORKSPACE}, ${c.auth === "key" ? `key from ${c.apiKeyEnv}` : "its own sign-in"}`);
  const start = Date.now();
  let last = Date.now();
  const child = spawn(bin!, args, { cwd: WORKSPACE, env, stdio: ["ignore", "pipe", "pipe"] });
  const stop = (message: string) => {
    console.error(`\n${message}`);
    child.kill();
  };
  const heartbeat = setInterval(() => {
    if (Date.now() - last >= 30_000) {
      console.log(`  … still working (${elapsed(Date.now() - start)})`);
      last = Date.now();
    }
  }, 5_000);

  let result: any;
  const onEvent = (e: any) => {
    last = Date.now();
    if (e.type === "system" && e.subtype === "init") {
      if (c.auth === "key" && e.apiKeySource !== "apiKeyHelper")
        return stop(`Stopped before any request: Claude Code would authenticate with "${e.apiKeySource}", not the key in ${c.apiKeyEnv}.`);
      console.log(`Started (Claude Code ${e.claude_code_version ?? ""}, ${e.model}). Progress:`);
    } else if (e.type === "system" && e.subtype === "api_retry") {
      if (e.error_status === 401 || e.error_status === 403)
        return stop(`The key in ${c.apiKeyEnv} was refused (HTTP ${e.error_status}): stopped.`);
      console.log(`  (the API asked to retry: ${e.error_status ?? e.error}; attempt ${e.attempt} of ${e.max_retries})`);
    } else if (e.type === "assistant") {
      for (const block of e.message?.content ?? []) {
        if (block.type === "text" && block.text?.trim()) console.log(`  ${short(block.text, 300)}`);
        else if (block.type === "tool_use") console.log(`→ ${describeTool(block.name, block.input)}`);
      }
    } else if (e.type === "user") {
      for (const block of Array.isArray(e.message?.content) ? e.message.content : [])
        if (block.type === "tool_result" && block.is_error) {
          const text = Array.isArray(block.content) ? block.content.map((x: any) => x.text ?? "").join(" ") : String(block.content ?? "");
          console.log(`  ✗ ${short(text, 200)}`);
        }
    } else if (e.type === "result") result = e;
  };

  let buffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line));
      } catch {
        console.log(`  ${short(line, 300)}`);
      }
    }
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));

  const status = await new Promise<number>((resolve) => child.on("close", (code) => resolve(code ?? 1)));
  clearInterval(heartbeat);
  if (result) {
    console.log(`\n${result.result ?? ""}`.trimEnd());
    const cost = typeof result.total_cost_usd === "number" ? `, $${result.total_cost_usd.toFixed(2)}` : "";
    console.log(`\n${result.is_error ? "Ended with an error" : "Done"} in ${elapsed(result.duration_ms ?? Date.now() - start)}${cost}, ${result.num_turns ?? "?"} turns.`);
  } else if (stderr.trim()) console.error(stderr.trim());
  return result?.is_error ? 1 : status;
};
