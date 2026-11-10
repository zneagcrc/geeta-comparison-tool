// geeta-compare install [<id> ...]: installs the calculators defined in geeta.config.json (all of them when none is
// named) at the version asked for, records the version installed in geeta.lock.json, and creates the plug-in and
// findings document from templates/calculator when they don't exist yet. Run it again to upgrade a calculator whose
// version is "latest". See src/calculators/config.ts for the definitions.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PACKAGE_ROOT, WORKSPACE, inWorkspace, workspaceConfig } from "./workspace";
import { type LockEntry, type ResolvedEntry, calculatorEntry, readLock, writeLock } from "./calculators/config";
import { apiKey, requestJsonSync } from "./http";

/** OpenAPI documents found while installing, by calculator id (recorded in the lock). */
const apiDocs: Record<string, string> = {};

const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

/** Runs a command in the workspace (through the shell, for npm.cmd on Windows); fails with its output. */
const run = (cmd: string, args: string[]) => {
  const quoted = args.map((a) => (/[\s"^&|<>]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  const r = spawnSync([cmd, ...quoted].join(" "), { cwd: WORKSPACE, shell: true, encoding: "utf8" });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} failed:\n${`${r.stdout ?? ""}${r.stderr ?? ""}`.trim()}`);
  return (r.stdout ?? "").trim();
};

const github = async (repo: string, route: string) => {
  const res = await fetch(`https://api.github.com/repos/${repo}/${route}`, {
    headers: { "User-Agent": "geeta-comparison-tool", Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) return undefined;
  if (!res.ok) fail(`GitHub ${repo}/${route}: HTTP ${res.status}`);
  return res.json() as Promise<any>;
};

/** Installs one calculator's release; returns the version installed. */
const installRelease = async (e: ResolvedEntry): Promise<string> => {
  switch (e.kind) {
    case "npm": {
      const pkg = e.target!;
      let version = e.requested;
      if (!EXACT.test(version)) {
        // A dist-tag ("latest", "beta") or a range: ask the registry what it is now
        const out = run("npm", ["view", `${pkg}@${version}`, "version", "--json"]);
        if (!out) fail(`npm has no ${pkg}@${version}`);
        const v = JSON.parse(out);
        version = Array.isArray(v) ? v[v.length - 1] : v;
      }
      run("npm", ["install", "--save-exact", `${pkg}@${version}`]);
      return version;
    }
    case "github": {
      const repo = e.target!;
      let tag = e.requested;
      if (tag === "latest") {
        const latest = await github(repo, "releases/latest");
        if (!latest) fail(`${repo} has no published GitHub release; give a tag as "version"`);
        tag = latest.tag_name;
      }
      run("npm", ["install", `github:${repo}#${tag}`]);
      return tag;
    }
    case "folder": {
      const dir = inWorkspace(e.target!);
      const pkgFile = path.join(dir, "package.json");
      if (!fs.existsSync(pkgFile)) fail(`${e.target} isn't a package folder (no package.json in ${dir})`);
      const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
      if (e.requested !== "latest" && e.requested !== pkg.version)
        console.log(`  note: ${e.target} is version ${pkg.version}, not ${e.requested}; linking it as it is`);
      run("npm", ["install", path.relative(WORKSPACE, dir).replace(/\\/g, "/") || "."]);
      return `${pkg.version ?? "0.0.0"}`;
    }
    case "api": {
      // The key must be there, and accepted; the API's own version comes from its OpenAPI document when it has one
      let key: string | undefined;
      try {
        key = apiKey(e.id);
      } catch (err) {
        return fail((err as Error).message);
      }
      const headers: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {};
      const doc = requestJsonSync("GET", `${e.apiUrl}/openapi.json`, undefined, headers, 30_000);
      if (doc.status === 0) fail(`${e.name} doesn't answer at ${e.apiUrl} (${doc.text}): is it running?`);
      if (doc.status === 401 || doc.status === 403)
        fail(`${e.name} refused the key${e.apiKeyEnv ? ` in ${e.apiKeyEnv}` : " (none set: add \"apiKeyEnv\" to its entry)"}: HTTP ${doc.status} ${doc.json?.error ?? ""}`.trim());
      if (doc.status === 200 && doc.json?.openapi) {
        apiDocs[e.id] = `${e.apiUrl}/openapi.json`;
        const v = doc.json.info?.version;
        console.log(`  ${e.apiUrl}: OpenAPI ${doc.json.openapi}, ${Object.keys(doc.json.paths ?? {}).length} endpoint(s)${v ? `, version ${v}` : ""}`);
        if (v) return String(v);
      } else console.log(`  ${e.apiUrl}: no OpenAPI document (HTTP ${doc.status}); recording the version as given`);
      return e.requested;
    }
    case "none":
      return e.requested;
  }
};

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);

/** Creates the plug-in and findings document from templates/calculator, if they don't exist yet. */
const scaffold = (e: ResolvedEntry) => {
  const made: string[] = [];
  const using =
    e.kind === "npm" || e.kind === "github"
      ? `// ${e.name} is installed as a package: import it here, e.g.\n// import * as calc from "${e.kind === "npm" ? e.target : e.target!.split("/")[1]}";`
      : e.kind === "folder"
        ? `// ${e.name} is linked from ${e.target}: import it by its package name here.`
        : e.kind === "api"
          ? `// ${e.name} is an HTTP API (${e.apiUrl}): adapters call it with api.post(<endpoint>, <body>).`
          : `// ${e.name} has no release to install: bring it into this plug-in yourself.`;
  const vars = { id: e.id, name: e.name, using };
  const files: [string, string][] = [
    [e.kind === "api" ? "api.ts" : "index.ts", e.plugin],
    ["findings.md", `findings/${e.id}.md`],
    ["mapping.json", path.posix.join(path.posix.dirname(e.plugin.replace(/\\/g, "/")), "mapping.json")],
  ];
  for (const [template, target] of files) {
    const dest = inWorkspace(target);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, fill(fs.readFileSync(path.join(PACKAGE_ROOT, "templates", "calculator", template), "utf8"), vars));
    made.push(target);
  }
  return made;
};

const main = async () => {
  const defined = Object.keys(workspaceConfig().calculators ?? {});
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!defined.length)
    fail(
      'No calculators in geeta.config.json yet. Add one, e.g.\n  "calculators": { "mycalc": { "name": "My Calculator", "release": "npm:@acme/emissions", "version": "latest" } }\nthen run: npx geeta-compare install mycalc',
    );
  for (const id of ids) if (!defined.includes(id)) fail(`geeta.config.json has no calculator "${id}" (it has: ${defined.join(", ")})`);

  const lock = readLock();
  for (const id of ids.length ? ids : defined) {
    const e = calculatorEntry(id);
    console.log(`${e.id}: ${e.name}, ${e.release ?? "no release"} @ ${e.requested}`);
    const version = await installRelease(e);
    const before = lock.calculators[id];
    const entry: LockEntry = {
      release: e.release ?? null,
      requested: e.requested,
      version,
      installed: new Date().toISOString(),
      ...(apiDocs[id] ? { openapi: apiDocs[id] } : {}),
    };
    lock.calculators[id] = entry;
    writeLock(lock);
    const change = !before ? "installed" : before.version === version ? "already at this version" : `upgraded from ${before.version}`;
    console.log(`  ${e.name} ${version}: ${change}`);
    if (before && before.version !== version)
      console.log(`  explanations recorded against ${before.version} will show as stale until they are reviewed (npm run explain -- status)`);
    for (const f of scaffold(e)) console.log(`  created ${f}`);
  }
  console.log("\nNext: write the adapters in the plug-in, then npm run test:veerg");
};

main();
