// The calculator workspace a command runs in: the folder with geeta.config.json, found from the current directory
// upwards (or GEETA_WORKSPACE). Everything per calculator lives there: the calculator plug-in, its explanations,
// findings document, comparison.config.json, scenario docs and the downloaded GEETA releases. This package (the core)
// holds only what every calculator shares.
//
//   geeta.config.json
//   {
//     "repo": "zneagcrc/GEETA",                 // where GEETA releases are published
//     "release": "VEERG_0.0.0.3",               // the release this workspace compares with (npm run geeta:fetch)
//     "calculators": {                          // the calculators to compare (src/calculators/config.ts)
//       "mycalc": { "name": "My Calculator", "release": "npm:@acme/emissions", "version": "latest" }
//     },
//     "calculator": "mycalc"                    // optional: the default when there are several
//   }
import fs from "node:fs";
import path from "node:path";

export const CONFIG_FILE_NAME = "geeta.config.json";

export type WorkspaceConfig = {
  repo: string;
  release: string;
  /** id -> its definition (src/calculators/config.ts); a plain string is just the plug-in path. */
  calculators?: Record<string, string | { name?: string; release?: string; version?: string; plugin?: string; apiKeyEnv?: string }>;
  calculator?: string;
};

const findWorkspace = (): string => {
  if (process.env.GEETA_WORKSPACE) {
    const dir = path.resolve(process.env.GEETA_WORKSPACE);
    if (!fs.existsSync(path.join(dir, CONFIG_FILE_NAME))) fail(`GEETA_WORKSPACE=${dir} has no ${CONFIG_FILE_NAME}`);
    return dir;
  }
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, CONFIG_FILE_NAME))) return dir;
    if (path.dirname(dir) === dir) break;
  }
  return fail(
    `No ${CONFIG_FILE_NAME} in ${process.cwd()} or above. Run this in a calculator workspace (README.md, "Setting up a workspace"), or set GEETA_WORKSPACE.`,
  );
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** The workspace folder (absolute). */
export const WORKSPACE = findWorkspace();

// Secrets such as API keys can sit in the workspace's .env (gitignored): KEY=value lines, read into the environment
// without overriding what is already set.
const envFile = path.join(WORKSPACE, ".env");
if (fs.existsSync(envFile))
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }

/** A path relative to the workspace, made absolute. */
export const inWorkspace = (...parts: string[]) => path.resolve(WORKSPACE, ...parts);

let config: WorkspaceConfig | undefined;
/** geeta.config.json, read once. */
export const workspaceConfig = (): WorkspaceConfig => {
  if (config) return config;
  const file = inWorkspace(CONFIG_FILE_NAME);
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8")) as WorkspaceConfig;
  } catch (e) {
    return fail(`${file} isn't valid JSON: ${(e as Error).message}`);
  }
  if (!config.repo || !config.release) fail(`${file} needs "repo" (e.g. "zneagcrc/GEETA") and "release" (e.g. "VEERG_0.0.0.3")`);
  return config;
};

/** This package's own folder (the core), wherever it is installed. */
export const PACKAGE_ROOT = path.resolve(__dirname, "..");
