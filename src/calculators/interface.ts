// A calculator's interface at each version it is installed at, so an upgrade can be adapted to from what changed rather
// than from scratch. `geeta-compare install` keeps a snapshot of the files that define the calculator's inputs (its type
// declarations, schemas, README and changelog; for an API, its OpenAPI document) in .geeta/interfaces/<id>/<version>/,
// and when the version changes, writes the difference from the previous snapshot to
// .geeta/upgrades/<id>/<from>..<to>.diff, with a summary for the agent beside it (.md: names renamed, removed and added,
// changed lines that recur). `geeta-compare llm adapter --upgrade` gives the agent the summary.
//
// Which files: the calculator entry's "interface" (files or folders, relative to the workspace) when it has one (needed
// for a calculator with no release, which the plug-in brings in itself), else the installed package. From a folder:
// its .d.ts files, or its .ts sources when it has none (tests left out), plus *schema*.json, openapi*.json, README and
// CHANGELOG files.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { WORKSPACE, inWorkspace } from "../workspace";
import { type ResolvedEntry, definedCalculators } from "./config";
import { apiKey, requestJsonSync } from "../http";

const MAX_BYTES = 200 * 1024 * 1024;
const SKIP_DIRS = new Set(["node_modules", ".git", "coverage", "test", "tests", "__tests__", ".turbo", ".cache"]);
const DOCS = /^(readme|changelog)(\.[a-z]+)?$/i;
const SCHEMA = /(schema|openapi)[^/\\]*\.json$/i;

const safe = (version: string) => version.replace(/[^\w.+-]+/g, "_");
export const snapshotDir = (id: string, version: string) => inWorkspace(".geeta", "interfaces", id, safe(version));
export const upgradeDiffFile = (id: string, from: string, to: string) => inWorkspace(".geeta", "upgrades", id, `${safe(from)}..${safe(to)}.diff`);

/** The folders or files that define a calculator's interface (absolute), or [] when there is nothing to snapshot. */
export const interfaceSources = (e: ResolvedEntry): string[] => {
  const own = definedCalculators().find((c) => c.id === e.id)?.entry as { interface?: string | string[] } | undefined;
  if (own?.interface) return (Array.isArray(own.interface) ? own.interface : [own.interface]).map((p) => inWorkspace(p));
  // The package's folder along Node's search paths from the workspace (its "exports" may not let package.json be resolved)
  const packageDir = (name: string) => {
    const dirs = createRequire(path.join(WORKSPACE, "package.json")).resolve.paths(name) ?? [];
    const dir = dirs.map((d) => path.join(d, name)).find((d) => fs.existsSync(path.join(d, "package.json")));
    return dir ? [dir] : [];
  };
  switch (e.kind) {
    case "npm":
      return packageDir(e.target!);
    case "github": {
      // Installed under its package name: the dependency whose spec names the repo
      const deps = { ...(workspacePackage().dependencies ?? {}), ...(workspacePackage().devDependencies ?? {}) };
      const name = Object.entries<string>(deps).find(([, spec]) => spec.includes(e.target!))?.[0];
      return name ? packageDir(name) : [];
    }
    case "folder":
      return [inWorkspace(e.target!)];
    default:
      return [];
  }
};
const workspacePackage = (): any => {
  try {
    return JSON.parse(fs.readFileSync(inWorkspace("package.json"), "utf8"));
  } catch {
    return {};
  }
};

/** The files of a source folder that define the interface, relative to it. */
const interfaceFiles = (dir: string): string[] => {
  const all: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(path.join(d, e.name));
      } else all.push(path.relative(dir, path.join(d, e.name)));
    }
  };
  walk(dir);
  const declarations = all.filter((f) => f.endsWith(".d.ts"));
  const code = declarations.length ? declarations : all.filter((f) => /\.tsx?$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f));
  return [...code, ...all.filter((f) => SCHEMA.test(f) || DOCS.test(path.basename(f)))];
};

/**
 * Keeps a snapshot of the calculator's interface at `version` (once: an existing snapshot is kept). Returns its folder,
 * or undefined with the reason when there is nothing to snapshot.
 */
export const snapshotInterface = (e: ResolvedEntry, version: string): { dir?: string; note?: string } => {
  const dir = snapshotDir(e.id, version);
  if (fs.existsSync(dir)) return { dir };
  if (e.kind === "api") {
    let key: string | undefined;
    try {
      key = apiKey(e.id);
    } catch {
      key = undefined;
    }
    const doc = requestJsonSync("GET", `${e.apiUrl}/openapi.json`, undefined, key ? { Authorization: `Bearer ${key}` } : {}, 30_000);
    if (doc.status !== 200 || !doc.json?.openapi) return { note: `no OpenAPI document at ${e.apiUrl}/openapi.json` };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "openapi.json"), JSON.stringify(doc.json, null, 2) + "\n");
    return { dir };
  }
  const sources = interfaceSources(e).filter((s) => fs.existsSync(s));
  if (!sources.length)
    return { note: e.kind === "none" ? `it has no release: give its entry "interface" (the folders that define its inputs) to keep one` : "its installed files weren't found" };
  let bytes = 0;
  const tmp = `${dir}.tmp`;
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const [n, src] of sources.entries()) {
    const files = fs.statSync(src).isDirectory() ? interfaceFiles(src).map((f) => [path.join(src, f), f]) : [[src, path.basename(src)]];
    for (const [from, rel] of files) {
      bytes += fs.statSync(from).size;
      if (bytes > MAX_BYTES) {
        fs.rmSync(tmp, { recursive: true, force: true });
        return { note: `its interface files are over ${MAX_BYTES / 1024 / 1024} MB: narrow them with "interface" in its entry` };
      }
      const to = path.join(tmp, sources.length > 1 ? String(n + 1) : "", rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
  if (!fs.existsSync(tmp)) return { note: "no interface files were found in its installed files" };
  fs.renameSync(tmp, dir);
  return { dir };
};


/** Every file of a snapshot, relative to it. */
const filesOf = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }))
      if (e.isDirectory()) walk(path.join(d, e.name));
      else out.push(path.relative(dir, path.join(d, e.name)).replace(/\\/g, "/"));
  };
  walk(dir);
  return out;
};

/** The property names a snapshot declares, with the files declaring each: type members in .ts, "properties" keys in JSON schemas. */
const declaredNames = (dir: string): Map<string, Set<string>> => {
  const names = new Map<string, Set<string>>();
  const add = (name: string, file: string) => (names.get(name) ?? names.set(name, new Set()).get(name)!).add(file);
  for (const f of filesOf(dir)) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    if (/\.tsx?$/.test(f)) for (const m of text.matchAll(/^\s*(?:readonly\s+)?["']?([A-Za-z_$][\w$]*)["']?\??\s*:/gm)) add(m[1], f);
    else if (f.endsWith(".json"))
      try {
        const visit = (o: any): void => {
          if (!o || typeof o !== "object") return;
          if (o.properties && typeof o.properties === "object") for (const k of Object.keys(o.properties)) add(k, f);
          for (const v of Object.values(o)) visit(v);
        };
        visit(JSON.parse(text));
      } catch {
        // not JSON after all
      }
  }
  return names;
};

/** How alike two names are: the length of their common start (a unit spelled out, say: massAppliedKg, massAppliedKilograms). */
const similarity = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n >= 3 ? n : 0;
};

const MAX_LISTED = 80;

/**
 * What changed in the calculator's interface between two versions: a summary for the agent (names renamed, removed and
 * added, the changed lines that recur, files added and removed) in .geeta/upgrades/<id>/<from>..<to>.md, and the full
 * difference beside it (.diff). Returns the summary, or undefined with the reason.
 */
export const interfaceDiff = (id: string, from: string, to: string): { file?: string; diff?: string; note?: string } => {
  const a = snapshotDir(id, from);
  const b = snapshotDir(id, to);
  if (!fs.existsSync(a)) return { note: `no snapshot of ${from} was kept (snapshots are kept from geeta-comparison-tool 0.3 on)` };
  if (!fs.existsSync(b)) return { note: `no snapshot of ${to} was kept` };
  const diff = upgradeDiffFile(id, from, to);
  const file = diff.replace(/\.diff$/, ".md");
  if (fs.existsSync(file) && fs.existsSync(diff)) return { file, diff };
  // git compares two folders without a repository; exit status 1 means they differ
  const r = spawnSync("git", ["diff", "--no-index", "--no-color", "--", path.relative(WORKSPACE, a), path.relative(WORKSPACE, b)], {
    cwd: WORKSPACE,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (r.error || (r.status !== 0 && r.status !== 1)) return { note: `git couldn't compare the snapshots (${r.error?.message ?? r.stderr.trim()})` };
  fs.mkdirSync(path.dirname(diff), { recursive: true });
  fs.writeFileSync(diff, `# Interface of ${id}: ${from} -> ${to}\n${r.stdout || "(no differences)\n"}`);

  // Files
  const fa = new Set(filesOf(a));
  const fb = new Set(filesOf(b));
  const addedFiles = [...fb].filter((f) => !fa.has(f));
  const removedFiles = [...fa].filter((f) => !fb.has(f));
  const changedFiles = [...fa].filter((f) => fb.has(f) && fs.readFileSync(path.join(a, f), "utf8") !== fs.readFileSync(path.join(b, f), "utf8"));

  // Names, and the renamings among them: a removed name and an added one declared in much the same files (of those both
  // versions have), the closest in spelling first
  const na = declaredNames(a);
  const nb = declaredNames(b);
  const removed = [...na.keys()].filter((n) => !nb.has(n));
  const added = [...nb.keys()].filter((n) => !na.has(n));
  const common = (s: Set<string>) => new Set([...s].filter((f) => fa.has(f) && fb.has(f)));
  const overlap = (x: Set<string>, y: Set<string>) => {
    const both = [...x].filter((f) => y.has(f)).length;
    return both / (x.size + y.size - both || 1);
  };
  const pairs = removed
    .flatMap((o) => added.map((n) => ({ o, n, score: overlap(common(na.get(o)!), common(nb.get(n)!)) })))
    .filter((p) => p.score >= 0.8)
    .sort((x, y) => y.score - x.score || similarity(y.o, y.n) - similarity(x.o, x.n));
  const renamed: [string, string][] = [];
  const taken = new Set<string>();
  for (const p of pairs)
    if (!taken.has(p.o) && !taken.has(p.n) && similarity(p.o, p.n) > 0) {
      renamed.push([p.o, p.n]);
      taken.add(p.o).add(p.n);
    }
  const free = new Set(added.filter((n) => !taken.has(n)));
  const renamedOld = new Set(renamed.map(([o]) => o));

  // Changed lines that recur (a type changed in many places shows once, with how often)
  const lines = new Map<string, number>();
  for (const l of (r.stdout ?? "").split("\n"))
    if (/^[-+](?![-+]{2} )/.test(l)) {
      const k = `${l[0]} ${l.slice(1).trim().replace(/\s+/g, " ")}`;
      // only lines that name something (not a lone bracket)
      if (/[A-Za-z]{2}/.test(k)) lines.set(k, (lines.get(k) ?? 0) + 1);
    }
  const recurring = [...lines].filter(([, n]) => n > 1).sort((x, y) => y[1] - x[1]);

  const list = (xs: string[]) => (xs.length > MAX_LISTED ? [...xs.slice(0, MAX_LISTED), `… and ${xs.length - MAX_LISTED} more`] : xs);
  const files = (n: string, m: Map<string, Set<string>>) => `${m.get(n)!.size} file${m.get(n)!.size === 1 ? "" : "s"}`;
  const out = [
    `# What changed in the interface of ${id}: ${from} -> ${to}`,
    "",
    `${changedFiles.length} files changed, ${addedFiles.length} added, ${removedFiles.length} removed (of ${fa.size}). The full difference is ` +
      `${path.basename(diff)} beside this file: search it for a name to see a change in context.`,
    "",
    `## Names renamed (probably: declared in much the same files, and spelled alike) (${renamed.length})`,
    "",
    ...list(renamed.map(([o, n]) => `- \`${o}\` -> \`${n}\` (${files(o, na)})`)),
    "",
    `## Names removed (${removed.length - renamed.length})`,
    "",
    ...list(removed.filter((n) => !renamedOld.has(n)).map((n) => `- \`${n}\` (${files(n, na)})`)),
    "",
    `## Names added (${free.size})`,
    "",
    ...list([...free].map((n) => `- \`${n}\` (${files(n, nb)})`)),
    "",
    `## Changed lines that recur (${recurring.length})`,
    "",
    "Each removed (-) or added (+) line with how many times it occurs in the difference: a type changed in many places shows here once.",
    "",
    ...list(recurring.map(([l, n]) => `- ${n}× \`${l}\``)),
    "",
    `## Files added (${addedFiles.length})`,
    "",
    ...list(addedFiles.map((f) => `- ${f}`)),
    "",
    `## Files removed (${removedFiles.length})`,
    "",
    ...list(removedFiles.map((f) => `- ${f}`)),
    "",
  ];
  fs.writeFileSync(file, out.join("\n"));
  return { file, diff };
};
