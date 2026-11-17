import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkContent, projectRoot, readLanguages } from "./content.mjs";
import { gameLevels } from "../src/bands.js";
import { survivalVersion } from "../src/survival-pack.js";

/** Preserve each question version and validate previous snapshots before bundling. */
export async function survivalArchives(pack, { root = projectRoot, create = true, reviewedOnly = false } = {}) {
  const directory = path.join(root, "archives", "survival", pack.locale);
  const current = {
    locale: pack.locale,
    levels: pack.levels.map(level => ({ ...level, words: level.words.filter(word => !word.dailyOn) })),
  };
  const version = survivalVersion(gameLevels(current));
  if (create) {
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(path.join(directory, version + ".json"), JSON.stringify(current, null, 2) + "\n", { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  const archives = {};
  let files;
  try { files = await readdir(directory); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    files = [];
  }
  for (const file of files.filter(file => file.endsWith(".json")).sort()) {
    const key = file.slice(0, -5);
    const snapshot = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    checkContent(snapshot, null, { reviewedOnly });
    const levels = gameLevels(snapshot);
    if (snapshot.locale !== pack.locale || !/^s1-[a-f0-9]{8}$/.test(key) ||
      levels.some(level => level.words.some(word => word.debutDay != null)) || survivalVersion(levels) !== key)
      throw new Error(`${pack.locale}/${file}: archived questions must match their version.`);
    archives[key] = levels;
  }
  if (!archives[version]) throw new Error(`${pack.locale}: run npm run build and commit the generated Survival archive.`);
  return archives;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  for (const { pack } of await readLanguages()) await survivalArchives(pack, { create: false });
  console.log("Survival archives match all current packs.");
}
