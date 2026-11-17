import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { languageFixture, fixturePack } from "./language-fixture.mjs";
import { buildGames } from "../scripts/build.mjs";
import { survivalArchives } from "../scripts/survival-archives.mjs";
import { gameLevels } from "../src/bands.js";
import { survivalVersion, createSurvival, readChallenge } from "../src/survival.js";

test("builds archive new content automatically and reproduce old links after edits", async () => {
  const fixture = await languageFixture();
  try {
    await assert.rejects(survivalArchives(fixturePack, { root: fixture.root, create: false }), /commit the generated/);
    await buildGames(fixture);
    const oldLevels = gameLevels(fixturePack);
    const version = survivalVersion(oldLevels);
    const directory = path.join(fixture.root, "archives/survival/en-GB");
    const original = await readFile(path.join(directory, version + ".json"), "utf8");
    const revised = structuredClone(fixturePack);
    revised.levels[0].words[0].answer = "reflect";
    await writeFile(path.join(fixture.root, "packs/en-GB.json"), JSON.stringify(revised));
    await buildGames(fixture);
    const archives = await survivalArchives(revised, { root: fixture.root, create: false });
    const invitation = readChallenge(new URLSearchParams({ seed: "7", v: version, score: "1" }), gameLevels(revised), archives);
    assert.deepEqual(invitation.run.cards, createSurvival(oldLevels, 7).cards);
    assert.equal(await readFile(path.join(directory, version + ".json"), "utf8"), original);
    assert.equal((await readdir(directory)).length, 2);
    const html = await readFile(path.join(fixture.outdir, "en-GB/index.html"), "utf8");
    assert.ok(html.includes(version));
    assert.ok(html.includes("consider") && html.includes("reflect"));
    await assert.rejects(survivalArchives(revised, { root: fixture.root, reviewedOnly: true }), /pilot questions/);
    const corrupted = JSON.parse(original);
    corrupted.levels[0].words[0].answer = "changed";
    await writeFile(path.join(directory, version + ".json"), JSON.stringify(corrupted));
    await assert.rejects(buildGames(fixture), /archived questions must match/);
    assert.equal(await readFile(path.join(fixture.outdir, "en-GB/index.html"), "utf8"), html);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
