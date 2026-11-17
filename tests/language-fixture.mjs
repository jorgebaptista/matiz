import { mkdtemp, mkdir, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { projectRoot } from "../scripts/content.mjs";
import fixtureLocale from "../locales/en-GB.json" with { type: "json" };

// Deliberately overlaps a PT-PT ID to prove storage cannot bleed between packs.
export const fixturePack = {
  locale: "en-GB",
  levels: [{ id: "0", name: "First steps", words: [{
    id: "ponderar", word: "ponder", answer: "consider",
    alternatives: ["confirm", "forget", "promise"],
    example: "She paused to ponder the two options.", origin: "human-written", status: "pilot",
  }] }],
};

export { fixtureLocale };

/** Create a disposable two-locale tree without adding a shipped second pack. */
export async function languageFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "matiz-languages-"));
  for (const folder of ["packs", "locales", "editorial"]) {
    await mkdir(path.join(root, folder));
    await copyFile(path.join(projectRoot, folder, "pt-PT.json"), path.join(root, folder, "pt-PT.json"));
  }
  await writeFile(path.join(root, "packs/en-GB.json"), JSON.stringify(fixturePack));
  await writeFile(path.join(root, "locales/en-GB.json"), JSON.stringify(fixtureLocale));
  await writeFile(path.join(root, "editorial/en-GB.json"), JSON.stringify({
    locale: "en-GB", words: [{
      id: "draft-only", word: "draft-only", answer: "unpublished",
      alternatives: ["first", "second", "third"], example: "A draft-only example.",
      origin: "human-written", status: "draft", targetLevel: 0,
      sense: "Unpublished test content.", references: ["https://example.org/draft-only"],
    }],
  }));
  return { root, outdir: path.join(root, "dist") };
}
