// geeta-compare init: sets up a comparison workspace in the current folder from templates/workspace, with no
// calculator yet: geeta.config.json (pinned to the latest GEETA release with a test set, "calculators" empty),
// comparison.config.json, CLAUDE.md, tsconfig.json, .gitignore and the package.json scripts. Calculators are added to
// geeta.config.json later and installed with `geeta-compare install <id>`.
import fs from "node:fs";
import path from "node:path";

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(PACKAGE_ROOT, "templates", "workspace");
const GEETA_REPO = "zneagcrc/GEETA";
/** Used when the GEETA releases can't be listed (offline): the latest known release with a test set. */
const FALLBACK_RELEASE = "VEERG_0.0.0.3";
/** The Claude Code version a new workspace gets (for `geeta-compare llm`). */
const CLAUDE_CODE = "^2.1.322";

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

if (process.argv.slice(2).some((a) => !a.startsWith("--")))
  fail('geeta-compare init takes no arguments: it sets up the workspace, and calculators are added to geeta.config.json afterwards (then: npx geeta-compare install <id>).');
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
  const vars = { release };
  const written: string[] = [];

  const copy = (from: string, to: string) => {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const src = path.join(from, entry.name);
      // npm drops .gitignore files from packages, so the template's is called gitignore
      const destName = entry.name === "gitignore" ? ".gitignore" : entry.name === "env.example" ? ".env.example" : entry.name;
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
  const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, "utf8")) : { name: "geeta-comparison", version: "1.0.0", private: true };
  const core = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
  pkg.scripts = {
    ...pkg.scripts,
    "geeta:fetch": "geeta-compare fetch",
    "geeta:install": "geeta-compare install",
    "test:veerg": "geeta-compare test",
    "docs:scenarios": "geeta-compare docs",
    explain: "geeta-compare explain",
    llm: "geeta-compare llm",
    typecheck: "tsc -p .",
  };
  delete pkg.scripts.test; // npm init's placeholder
  // TypeScript for `npm run typecheck`, and Claude Code, the agent `geeta-compare llm` runs
  pkg.devDependencies = { ...core.devDependencies, "@anthropic-ai/claude-code": CLAUDE_CODE, ...pkg.devDependencies };
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");
  written.push("package.json (scripts, devDependencies)");

  console.log(`Comparison workspace, compared with GEETA ${release}:`);
  for (const f of written) console.log(`  ${f}`);
  console.log(
    [
      "",
      "Next: npm install, then npm run geeta:fetch.",
      "To compare a calculator, define it in geeta.config.json, e.g.",
      '  "calculators": { "mycalc": { "name": "My Calculator", "release": "npm:@acme/emissions", "version": "latest" } }',
      "then: npx geeta-compare install mycalc",
      "To use an LLM (writing adapters, explaining differences): copy .env.example to .env, set ANTHROPIC_API_KEY, and check with: npx geeta-compare llm",
    ].join("\n"),
  );
};

main();
