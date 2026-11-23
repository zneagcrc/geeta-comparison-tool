// Where the GEETA test set comes from: the release pinned in the workspace's geeta.config.json (downloaded with
// `geeta-compare fetch` into <workspace>/geeta-releases/<release>/), unless overridden to use local work in progress.
// In order of precedence:
//   1. VEERG_TEST_DIR=<a Test folder>              (environment; its parent holds InputFields/, Modules/, ...)
//   2. GEETA_DIR=<a folder holding Test/>           (environment, e.g. ../GAF-VEERG-Functions)
//   3. geeta.local.json { "dir": "<folder>" }       (gitignored; your own standing override)
//      or geeta.local.json { "release": "<tag>" }   (another downloaded release)
//   4. geeta.config.json { "release": "<tag>" }     (the pinned release every calculator provider uses)
// Relative paths in the JSON files are relative to the workspace; in the environment, to the current directory.
// VEERG_DOCUMENTS_DIR or geeta.local.json "veergDocuments" point at a folder of VEERG methodology documents (they
// aren't in the public release).
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE, inWorkspace, workspaceConfig } from "./workspace";
import { DEFAULT_TOKEN_ENV } from "./geeta-github";

/** Paths in messages are shown relative to the workspace. */
export const ROOT = WORKSPACE;
export const RELEASES_DIR = inWorkspace("geeta-releases");

/**
 * The GEETA repository and release pinned in geeta.config.json, and the token for a private repository: the variable
 * "tokenEnv" names (GEETA_TOKEN by default), from the environment or the workspace's .env; undefined when it isn't set.
 */
export const geetaConfig = () => {
  const { repo, release, tokenEnv = DEFAULT_TOKEN_ENV } = workspaceConfig() as { repo: string; release: string; tokenEnv?: string };
  return { repo, release, tokenEnv, token: process.env[tokenEnv] || undefined };
};

type LocalConfig = { dir?: string; release?: string; veergDocuments?: string };
const local = ((): LocalConfig => {
  const p = inWorkspace("geeta.local.json");
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")) as LocalConfig;
  } catch (e) {
    throw new Error(`geeta.local.json isn't valid JSON: ${(e as Error).message}`);
  }
})();
/** Config paths are relative to the workspace. */
const fromRoot = (p: string) => inWorkspace(p);
/** Environment paths are relative to where the command was run. */
const fromCwd = (p: string) => path.resolve(p);

export type GeetaSource =
  | { kind: "release"; release: string; dir: string; via: string }
  | { kind: "local"; dir: string; via: string };

const resolveSource = (): GeetaSource => {
  if (process.env.VEERG_TEST_DIR) return { kind: "local", dir: path.dirname(fromCwd(process.env.VEERG_TEST_DIR)), via: "VEERG_TEST_DIR" };
  if (process.env.GEETA_DIR) return { kind: "local", dir: fromCwd(process.env.GEETA_DIR), via: "GEETA_DIR" };
  if (local.dir) return { kind: "local", dir: fromRoot(local.dir), via: "geeta.local.json" };
  if (local.release) return { kind: "release", release: local.release, dir: path.join(RELEASES_DIR, local.release), via: "geeta.local.json" };
  const { release } = geetaConfig();
  return { kind: "release", release, dir: path.join(RELEASES_DIR, release), via: "geeta.config.json" };
};

/** The GEETA test set this run reads. */
export const GEETA = resolveSource();

/** The Test folder (Test.json, TestInput_*.json, TestResults_*.json): VEERG_TEST_DIR itself when that is set. */
export const TEST_DIR = process.env.VEERG_TEST_DIR ? fromCwd(process.env.VEERG_TEST_DIR) : path.join(GEETA.dir, "Test");

/** The VEERG methodology documents, if any: not in the public release, so set them locally (see the top of this file). */
export const VEERG_DOCUMENTS_DIR = process.env.VEERG_DOCUMENTS_DIR
  ? fromCwd(process.env.VEERG_DOCUMENTS_DIR)
  : local.veergDocuments
    ? fromRoot(local.veergDocuments)
    : path.join(GEETA.dir, "VEERG documents");

/** The generated test workbooks: TestExcel/ in a release, Excel/TestExcel/ in a GAF-VEERG-Functions working copy. */
/** The release's input field definitions (labels, units, options) for every workbook. */
export const INPUT_FIELDS_DIR = path.resolve(TEST_DIR, "../InputFields");

/** The InputFields file's base name for a test workbook: <base>_InputFields.json. */
export const inputFieldsBaseName = (excelFile: string) => {
  let b = excelFile.replace(/\.xlsx?$/i, "").replace(/_WIP_v\d+$/i, "").replace(/_(Template|Clean)$/i, "");
  if (/^Enterprise_/i.test(b)) return b;
  return b.replace(/^\d+(?:_\d+)?_/, "");
};

export const TEST_EXCEL_DIR = fs.existsSync(path.join(GEETA.dir, "TestExcel")) ? path.join(GEETA.dir, "TestExcel") : path.join(GEETA.dir, "Excel/TestExcel");

/** One line for run headers and docs: "GEETA VEERG_0.0.0.3" or "GEETA local work in progress: <dir> (GEETA_DIR)". */
export const geetaLabel = () =>
  GEETA.kind === "release"
    ? `GEETA ${GEETA.release}${GEETA.via === "geeta.config.json" ? "" : ` (${GEETA.via})`}`
    : `GEETA local work in progress: ${path.relative(ROOT, GEETA.dir) || "."} (${GEETA.via})`;

/** Stops with a plain message when the test set isn't there (a pinned release not downloaded yet, or a wrong override). */
export const requireTestSet = () => {
  if (fs.existsSync(path.join(TEST_DIR, "Test.json"))) return;
  console.error(
    GEETA.kind === "release"
      ? `GEETA release ${GEETA.release} isn't downloaded yet (no ${path.relative(ROOT, TEST_DIR)}/Test.json). Run: npx geeta-compare fetch${GEETA.via === "geeta.config.json" ? "" : ` ${GEETA.release}`}`
      : `No Test.json in ${TEST_DIR} (set by ${GEETA.via}). Point it at a folder holding Test/, InputFields/ and Modules/.`,
  );
  process.exit(1);
};
