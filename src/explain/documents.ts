// The VEERG methodology documents to cite when explaining a difference, chosen deterministically from the VEERG
// documents folder (GAF-VEERG-Functions/VEERG documents; not in the public GEETA release, so a provider points
// VEERG_DOCUMENTS_DIR or geeta.local.json "veergDocuments" at their own copy). For each chapter the best version wins:
//   1. soft launch (VEERG documents/soft-launch/*.pdf, v1.0 of 16 Oct 2026)
//   2. pre-release, accepted (VEERG documents/pre-release/*accepted*.docx)
//   3. pre-release
//   4. consultation (the March 2026 set in VEERG documents/)
// with the newer file winning a tie. New pre-release chapters are picked up as soon as they are added.
import fs from "node:fs";
import path from "node:path";
import { VEERG_DOCUMENTS_DIR } from "../geeta-source";

export const DOCS_DIR = VEERG_DOCUMENTS_DIR;

export type Status = "soft launch" | "pre-release accepted" | "pre-release" | "consultation";
const RANK: Record<Status, number> = { "soft launch": 0, "pre-release accepted": 1, "pre-release": 2, consultation: 3 };

export type VeergDocument = {
  file: string;
  /** Chapters covered; "A" for the appendix, "CRF" for the Common Requirements Framework. */
  chapters: string[];
  status: Status;
  modified: Date;
};

/**
 * Chapters a file name covers: "Chapter_3_…" / "MG_Chapter3_…" -> [3], "Chapters_10_to_13_…" / "MG_Chapters14to15_…"
 * -> [10..13], "Appendix_A…" / "MG_AppendixA…" -> [A].
 */
const chaptersOf = (name: string): string[] => {
  const range = name.match(/Chapters_?(\d+)_?to_?(\d+)/i);
  if (range) {
    const [lo, hi] = [Number(range[1]), Number(range[2])];
    return Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i));
  }
  const single = name.match(/Chapter_?(\d+)/i);
  if (single) return [single[1]];
  if (/Appendix_?A/i.test(name)) return ["A"];
  if (/Common[_ ]Requirements/i.test(name)) return ["CRF"];
  return [];
};

export const listDocuments = (): VeergDocument[] => {
  if (!fs.existsSync(DOCS_DIR)) return [];
  const out: VeergDocument[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name);
      if (e.isDirectory()) walk(file);
      else if (/\.(docx|pdf)$/i.test(e.name) && !e.name.startsWith("~$")) {
        const chapters = chaptersOf(e.name);
        if (!chapters.length) continue; // e.g. the consultation response template
        const rel = path.relative(DOCS_DIR, file);
        const pre = /pre-release/i.test(rel);
        out.push({
          file,
          chapters,
          status: /soft-launch/i.test(rel) ? "soft launch" : pre ? (/accepted/i.test(e.name) ? "pre-release accepted" : "pre-release") : "consultation",
          modified: fs.statSync(file).mtime,
        });
      }
    }
  };
  walk(DOCS_DIR);
  return out;
};

/** The document to cite for a chapter, and the other versions (not to be cited). */
export const documentFor = (chapter: string, docs = listDocuments()) => {
  const candidates = docs
    .filter((d) => d.chapters.includes(chapter))
    .sort((a, b) => RANK[a.status] - RANK[b.status] || b.modified.getTime() - a.modified.getTime());
  return { use: candidates[0], others: candidates.slice(1) };
};

/** VEERG chapters behind a set of result names: VEERG_4_6_1_1__… -> "4", VEERG_14_1_1__… -> "14". */
export const chaptersOfResults = (keys: string[]) =>
  [...new Set(keys.map((k) => k.match(/^VEERG_(\d+)_/)?.[1]).filter((c): c is string => !!c))].sort((a, b) => Number(a) - Number(b));
