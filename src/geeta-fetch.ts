// Downloads a public GEETA release (the workbooks zip and its test set) into geeta-releases/<release>/, checking every
// file against the release's manifest.json. This is what calculator providers use; see geeta-source.ts for overriding
// it with local work in progress.
//
//   npm run geeta:fetch                     # the release pinned in geeta.config.json
//   npm run geeta:fetch -- VEERG_0.0.0.4    # another release (use it with geeta.local.json { "release": ... })
//   npm run geeta:fetch -- --force          # download again even if it is already there
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { unzipSync } from "fflate";
import { RELEASES_DIR, ROOT, geetaConfig } from "./geeta-source";

/** The manifest toolingContract versions this tool can read (bumped when the fixture format changes). */
const SUPPORTED_CONTRACTS = [1];

type Manifest = {
  release: string;
  toolingContract?: { version: number };
  workbooks: { file: string; sha256: string }[];
  dataFiles: { file: string; sha256: string }[];
  tests?: { asset: string; sha256: string; files: { path: string; sha256: string }[] };
};

const args = process.argv.slice(2);
const force = args.includes("--force");
const { repo, release: pinned } = geetaConfig();
const release = args.find((a) => !a.startsWith("--")) ?? pinned;
const target = path.join(RELEASES_DIR, release);

const sha256 = (data: Uint8Array) => crypto.createHash("sha256").update(data).digest("hex");

const download = async (asset: string): Promise<Uint8Array> => {
  const url = `https://github.com/${repo}/releases/download/${encodeURIComponent(release)}/${encodeURIComponent(asset)}`;
  process.stdout.write(`Downloading ${asset} ... `);
  const res = await fetch(url, { headers: { "User-Agent": "geeta-comparison-tool" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}${res.status === 404 ? ` (is ${release} a published release of ${repo}, with ${asset}?)` : ""}`);
  const data = new Uint8Array(await res.arrayBuffer());
  console.log(`${(data.length / 1048576).toFixed(1)} MB`);
  return data;
};

/** A zip's entries by normalised relative path (some release zips use backslashes); refuses paths that leave the folder. */
const entries = (zip: Uint8Array, name: string) => {
  const out = new Map<string, Uint8Array>();
  for (const [raw, data] of Object.entries(unzipSync(zip))) {
    const rel = raw.replace(/\\/g, "/");
    if (rel.endsWith("/")) continue;
    const norm = path.posix.normalize(rel);
    if (norm.startsWith("../") || path.posix.isAbsolute(norm) || /^[a-z]:/i.test(norm)) throw new Error(`${name}: unsafe path ${raw}`);
    out.set(norm, data);
  }
  return out;
};

const main = async () => {
  if (fs.existsSync(path.join(target, "Test", "Test.json")) && !force) {
    console.log(`${release} is already in ${path.relative(ROOT, target)} (--force downloads it again).`);
    return;
  }

  const main = entries(await download(`${release}.zip`), `${release}.zip`);
  const manifestData = main.get("manifest.json");
  if (!manifestData) throw new Error(`${release}.zip has no manifest.json`);
  const manifest = JSON.parse(Buffer.from(manifestData).toString("utf8")) as Manifest;
  if (manifest.release !== release) throw new Error(`${release}.zip's manifest is for ${manifest.release}`);
  const contract = manifest.toolingContract?.version;
  if (!SUPPORTED_CONTRACTS.includes(contract as number))
    throw new Error(`${release} uses tooling contract ${contract ?? "(none)"}; this tool reads ${SUPPORTED_CONTRACTS.join(", ")}. Update geeta-comparison-tool.`);
  if (!manifest.tests) throw new Error(`${release} has no test set (no "tests" in its manifest), so it can't be compared with.`);

  const testsZip = await download(manifest.tests.asset);
  if (sha256(testsZip) !== manifest.tests.sha256) throw new Error(`${manifest.tests.asset}: SHA-256 doesn't match the manifest`);
  const tests = entries(testsZip, manifest.tests.asset);

  // Every file the manifest lists must be present and match; files it doesn't list are kept but reported
  const expected = new Map<string, string>([
    ...manifest.workbooks.map((w) => [w.file, w.sha256] as const),
    ...manifest.dataFiles.map((d) => [d.file, d.sha256] as const),
    ...manifest.tests.files.map((f) => [f.path, f.sha256] as const),
  ]);
  const all = new Map([...main, ...tests]);
  const problems: string[] = [];
  for (const [file, hash] of expected) {
    const data = all.get(file);
    if (!data) problems.push(`missing ${file}`);
    else if (sha256(data) !== hash) problems.push(`SHA-256 mismatch ${file}`);
  }
  if (problems.length) throw new Error(`${release} doesn't match its manifest:\n  ${problems.join("\n  ")}`);
  const unlisted = [...all.keys()].filter((f) => !expected.has(f) && !["manifest.json", "README.md"].includes(f));

  // Write to a temporary folder, then swap it in, so an interrupted fetch never leaves a half release behind
  const partial = `${target}.partial`;
  fs.rmSync(partial, { recursive: true, force: true });
  for (const [file, data] of all) {
    const out = path.join(partial, ...file.split("/"));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, data);
  }
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(partial, target);

  console.log(`${release}: ${expected.size} files checked against its manifest, written to ${path.relative(ROOT, target)}`);
  if (unlisted.length) console.log(`  not in the manifest (kept): ${unlisted.join(", ")}`);
  if (release !== pinned) console.log(`  geeta.config.json pins ${pinned}; to use ${release}, set geeta.local.json { "release": "${release}" }`);
};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
