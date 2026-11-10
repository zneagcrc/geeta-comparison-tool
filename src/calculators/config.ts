// The calculators a workspace compares, as geeta.config.json defines them, and what `geeta-compare install` recorded
// for each in geeta.lock.json.
//
//   "calculators": {
//     "mycalc": {
//       "name": "My Calculator",                 // shown in reports ("My Calculator defect")
//       "release": "npm:@acme/emissions",        // where its releases come from (below)
//       "version": "latest",                     // or an exact version / tag
//       "plugin": "calculators/mycalc/index.ts"  // optional; this is the default
//     }
//   }
//
// release:
//   npm:<package>          an npm package                       version: a version, a dist-tag, or "latest"
//   github:<owner>/<repo>  a GitHub repo, installed at a release tag   version: a tag, or "latest" (newest release)
//   <folder>               a local package folder (relative to the workspace), linked; version from its package.json
//   http(s)://...          an HTTP API: nothing to install; adapters call it with apiClient (src/http.ts). A
//                          "{version}" in the URL is replaced by the version (e.g. .../VEERG/{version} with "draft");
//                          "apiKeyEnv" names the environment variable (or .env entry) holding its key, sent as
//                          Authorization: Bearer. install records the API's own version from <url>/openapi.json.
//   (none)                 nothing to install: the plug-in brings its own calculator
import fs from "node:fs";
import { inWorkspace, workspaceConfig } from "../workspace";

export type CalculatorEntry = {
  name?: string;
  release?: string;
  version?: string;
  plugin?: string;
  /** For an API: the environment variable holding its key (never the key itself). */
  apiKeyEnv?: string;
};

export type ReleaseKind = "npm" | "github" | "folder" | "api" | "none";

export type ResolvedEntry = {
  id: string;
  name: string;
  plugin: string;
  release?: string;
  kind: ReleaseKind;
  /** npm package name, "owner/repo", folder path or URL. */
  target?: string;
  /** As written in the config ("latest" when not given). */
  requested: string;
  /** For an API: the URL with the version filled in, and the environment variable holding its key. */
  apiUrl?: string;
  apiKeyEnv?: string;
};

/** A calculator's entry, with the defaults filled in (an entry may also be just the plug-in path, as before 0.2). */
export const calculatorEntry = (id: string): ResolvedEntry => {
  const raw = workspaceConfig().calculators?.[id];
  if (raw === undefined) throw new Error(`geeta.config.json has no calculator "${id}"`);
  const entry: CalculatorEntry = typeof raw === "string" ? { plugin: raw } : raw;
  const release = entry.release?.trim() || undefined;
  const [kind, target]: [ReleaseKind, string | undefined] = !release
    ? ["none", undefined]
    : release.startsWith("npm:")
      ? ["npm", release.slice(4)]
      : release.startsWith("github:")
        ? ["github", release.slice(7)]
        : /^https?:\/\//.test(release)
          ? ["api", release]
          : ["folder", release];
  const requested = entry.version?.trim() || "latest";
  return {
    id,
    name: entry.name ?? id,
    plugin: entry.plugin ?? `calculators/${id}/index.ts`,
    release,
    kind,
    target,
    requested,
    apiUrl: kind === "api" ? target!.replace(/\{version\}/g, encodeURIComponent(requested)).replace(/\/+$/, "") : undefined,
    apiKeyEnv: entry.apiKeyEnv,
  };
};

export type LockEntry = {
  release: string | null;
  requested: string;
  /** The version installed (what "latest" resolved to when installed). */
  version: string;
  installed: string;
  /** For an API with an OpenAPI document: where it is (for working out the calculator's inputs). */
  openapi?: string;
};
type Lock = { calculators: Record<string, LockEntry> };

const LOCK_FILE = "geeta.lock.json";

export const readLock = (): Lock => {
  const file = inWorkspace(LOCK_FILE);
  if (!fs.existsSync(file)) return { calculators: {} };
  return JSON.parse(fs.readFileSync(file, "utf8")) as Lock;
};

export const writeLock = (lock: Lock) =>
  fs.writeFileSync(inWorkspace(LOCK_FILE), JSON.stringify(lock, null, 2) + "\n");

/** The version `install` recorded for a calculator, if any. */
export const lockedVersion = (id: string): string | undefined => readLock().calculators[id]?.version;
