// geeta-compare init <id> ["<Name>"]: sets up a calculator workspace in the current folder from templates/workspace:
// geeta.config.json (pinned to the latest GEETA release with a test set), calculator/index.ts, findings.md,
// comparison.config.json, CLAUDE.md, tsconfig.json, .gitignore and the package.json scripts.
import fs from "node:fs";
import path from "node:path";

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(PACKAGE_ROOT, "templates", "workspace");
const GEETA_REPO = "zneagcrc/GEETA";
/** Used when the GEETA releases can't be listed (offline): the latest known release with a test set. */
const FALLBACK_RELEASE = "VEERG_0.0.0.3";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const [id, name = id] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!id) fail('Usage: geeta-compare init <id> ["<Name>"]   e.g. geeta-compare init mycalc "My Calculator"');
if (!/^[a-z][a-z0-9-]*$/.test(id)) fail(`The id "${id}" must be lower case letters, digits and dashes (it names folders)`);
const dir = process.cwd();
if (fs.existsSync(path.join(dir, "geeta.config.json"))) fail(`${dir} already has a geeta.config.json`);

/** The newest published GEETA release that has a test set. */
const latestRelease = async () => {
  try {
    const res = await fetch(`https://api.github.com/repos/${GEETA_REPO}/releases?per_page=20`, {
      headers: { "User-Agent": "geeta-comparison-tool", Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const releases = (await res.json()) as { tag_name: string; draft: boolean; assets: { name: string }[] }[];
    const withTests = releases.find((r) => !r.draft && r.assets.some((a) => a.name === `${r.tag_name}_tests.zip`));
    if (withTests) return withTests.tag_name;
    throw new Error("no release with a test set");
  } catch (e) {
    console.log(`Couldn't list the GEETA releases (${(e as Error).message}); pinning ${FALLBACK_RELEASE}.`);
    return FALLBACK_RELEASE;
  }
};

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);

const main = async () => {
  const release = await latestRelease();
  const vars = { id, name, release };
  const written: string[] = [];

  const copy = (from: string, to: string) => {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const src = path.join(from, entry.name);
      // npm drops .gitignore files from packages, so the template's is called gitignore
      const destName = entry.name === "gitignore" ? ".gitignore" : entry.name;
      const dest = path.join(to, destName);
      if (entry.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        copy(src, dest);
        continue;
      }
      const text = fill(fs.readFileSync(src, "utf8"), vars);
      if (destName === ".gitignore" && fs.existsSync(dest)) {
        const have = new Set(fs.readFileSync(dest, "utf8").split(/\r?\n/));
        const add = text.split("\n").filter((l) => l && !have.has(l));
        if (add.length) fs.appendFileSync(dest, `\n${add.join("\n")}\n`);
      } else if (fs.existsSync(dest)) {
        console.log(`  kept your ${path.relative(dir, dest)}`);
        continue;
      } else fs.writeFileSync(dest, text);
      written.push(path.relative(dir, dest));
    }
  };
  copy(TEMPLATE, dir);

  // package.json: the workspace scripts, and TypeScript for `npm run typecheck`
  const pkgFile = path.join(dir, "package.json");
  const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, "utf8")) : { name: `${id}-vs-geeta`, version: "1.0.0", private: true };
  const core = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
  pkg.scripts = {
    ...pkg.scripts,
    "geeta:fetch": "geeta-compare fetch",
    "test:veerg": "geeta-compare test",
    "docs:scenarios": "geeta-compare docs",
    explain: "geeta-compare explain",
    typecheck: "tsc -p .",
  };
  delete pkg.scripts.test; // npm init's placeholder
  pkg.devDependencies = { ...core.devDependencies, ...pkg.devDependencies };
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");
  written.push("package.json (scripts, devDependencies)");

  console.log(`Workspace for ${name} (${id}), compared with GEETA ${release}:`);
  for (const f of written) console.log(`  ${f}`);
  console.log("\nNext: npm install, npm run geeta:fetch, add adapters to calculator/index.ts, npm run test:veerg");
};

main();
