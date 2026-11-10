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
// Every field is optional: these are the defaults. With "key", Claude Code runs in --bare mode, so it never falls back
// to a sign-in it finds on the machine (it would otherwise prefer one over the key).
// The LLM never runs in `test`, `docs`, `explain status/bundle/add` or `mapping`: only in `geeta-compare llm ...`.
import { spawnSync } from "node:child_process";
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

/** Runs a command in the workspace through the shell (npx is npx.cmd on Windows), passing arguments safely quoted. */
const shell = (args: string[], opts: { env?: NodeJS.ProcessEnv; inherit?: boolean } = {}) => {
  const quoted = args.map((a) => (/[\s"'^&|<>()*%!]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  return spawnSync(quoted.join(" "), { cwd: WORKSPACE, shell: true, encoding: "utf8", env: opts.env ?? process.env, stdio: opts.inherit ? "inherit" : "pipe" });
};

/** The Claude Code version installed in the workspace (npx --no-install claude), or undefined. */
export const claudeCodeVersion = (): string | undefined => {
  const r = shell(["npx", "--no-install", "claude", "--version"]);
  return r.status === 0 ? r.stdout.trim().split(/\r?\n/)[0] : undefined;
};

/** What the agent may do: read and edit files, and run this tool's commands and the workspace's npm scripts. */
const ALLOWED_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep", "Bash(npx geeta-compare *)", "Bash(npm run *)"];

/**
 * Runs Claude Code non-interactively in the workspace on the configured model and key, with `prompt` as the task. The
 * workspace's CLAUDE.md gives it the rules; it may only edit files and run geeta-compare and npm scripts. Returns
 * Claude Code's exit status.
 */
export const runAgent = (prompt: string): number => {
  const c = llmConfig();
  requireSupportedProvider(c);
  if (!claudeCodeVersion()) {
    console.error("Claude Code isn't installed in this workspace: npm install --save-dev @anthropic-ai/claude-code");
    process.exit(1);
  }
  const key = llmKey(c);
  // "key": Claude Code's --bare mode, where the key is the only credential it reads; it then doesn't find CLAUDE.md
  // by itself, so it is passed in. "sign-in": Claude Code as it is, with its own sign-in.
  if (c.auth === "key" && !key) {
    console.error(
      `${c.apiKeyEnv} isn't set: put ${c.apiKeyEnv}=<key> in the workspace's .env (or set "auth": "sign-in" in geeta.config.json llm to use Claude Code's own sign-in).`,
    );
    process.exit(1);
  }
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (c.auth === "key") env.ANTHROPIC_API_KEY = key;
  else delete env.ANTHROPIC_API_KEY;
  const mode = c.auth === "key" ? ["--bare", "--append-system-prompt-file", "CLAUDE.md"] : [];
  console.log(`Running Claude Code (${c.model}, ${c.auth === "key" ? `key from ${c.apiKeyEnv}` : "its own sign-in"}) in ${WORKSPACE}\n`);
  const r = shell(
    ["npx", "--no-install", "claude", "-p", prompt, ...mode, "--model", c.model, "--permission-mode", "acceptEdits", "--allowedTools", ALLOWED_TOOLS.join(",")],
    { env, inherit: true },
  );
  return r.status ?? 1;
};
