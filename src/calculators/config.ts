// The calculators a workspace compares, as geeta.config.json defines them, and what `geeta-compare install` recorded
// for each in geeta.lock.json.
//
//   "calculators": [
//     {
//       "name": "My Calculator",                         // its name: shown in reports, and its id is made from it
//       "release": "npm:@acme/emissions",                // where its releases come from (below)
//       "version": "latest",                             // or an exact version / tag
//       "plugin": "calculators/my-calculator/index.ts"   // optional; this is the default
//     }
//   ]
//
// The id names the calculator's folders (calculators/<id>/, explanations/<id>/, findings/<id>.md, docs/<id>/): the
// name in lower case with anything but letters and digits as dashes ("My Calculator" -> "my-calculator", "ACME" ->
// "acme"), or an explicit "id". Commands take the name or the id. The older form, an object keyed by id
// ("calculators": { "mycalc": { "name": ... } }), still works.
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
  /** Only to override the id made from the name (it names the folders). */
  id?: string;
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

/** The id made from a name: lower case, anything but letters and digits as one dash ("Method workbench" -> "method-workbench"). */
export const idOf = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

/** The calculators geeta.config.json defines, in order, with their ids: a list of entries, or the older object keyed by id. */
export const definedCalculators = (): { id: string; entry: CalculatorEntry }[] => {
  const raw = workspaceConfig().calculators;
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw.map((e, i) => {
        if (!e || typeof e !== "object" || (!e.name && !e.id)) fail(`geeta.config.json calculators[${i}] needs a "name"`);
        const id = e.id ?? idOf(e.name!);
        if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail(`geeta.config.json calculators[${i}]: "${e.name}" makes no usable id; give it an "id" (lower case letters, digits, dashes)`);
        return { id, entry: e as CalculatorEntry };
      })
    : Object.entries(raw).map(([id, e]) => ({ id, entry: (typeof e === "string" ? { plugin: e } : e) as CalculatorEntry }));
  const seen = new Set<string>();
  for (const { id } of list) {
    if (seen.has(id)) fail(`geeta.config.json: two calculators have the id "${id}"; give one of them an "id"`);
    seen.add(id);
  }
  return list;
};

/** The id of the calculator a command names: its id, or its name (any case). */
export const resolveCalculatorId = (nameOrId: string): string | undefined => {
  const list = definedCalculators();
  const n = nameOrId.trim().toLowerCase();
  return (list.find((c) => c.id === n) ?? list.find((c) => c.entry.name?.toLowerCase() === n) ?? list.find((c) => c.id === idOf(nameOrId)))?.id;
};

/**
 * The id for a name or id a plug-in passes (to mapping(), apiClient(), ...); throws an error that says where the name came
 * from and which calculators exist, e.g. after a calculator was renamed and the plug-in still uses the old name.
 */
export const requireCalculatorId = (nameOrId: string, where: string): string => {
  const id = resolveCalculatorId(nameOrId);
  if (id) return id;
  const have = definedCalculators().map((c) => (c.entry.name && c.entry.name !== c.id ? `${c.entry.name} (${c.id})` : c.id));
  throw new Error(`${where}: no calculator "${nameOrId}" in geeta.config.json (it has: ${have.join(", ") || "none"}). Use one of those names in the plug-in.`);
};

/** A calculator's entry, with the defaults filled in (an entry may also be just the plug-in path, as before 0.2). */
export const calculatorEntry = (id: string): ResolvedEntry => {
  const found = definedCalculators().find((c) => c.id === id);
  if (!found) throw new Error(`geeta.config.json has no calculator "${id}"`);
  const entry = found.entry;
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
