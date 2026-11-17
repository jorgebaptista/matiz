import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { languageFixture, fixturePack } from "./language-fixture.mjs";
import { buildGames } from "../scripts/build.mjs";
import { gameLevels } from "../src/bands.js";
import { survivalVersion } from "../src/survival.js";
import { checkSharedImage } from "./share-image-helper.mjs";

/** Play a run, send its link to a fresh player and compare their saved questions. */
export async function testSurvival(browser) {
  for (const locale of ["pt-PT", "en-GB"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const friend = await browser.newContext({ viewport: { width: 360, height: 740 } });
    try {
      const suffix = locale === "pt-PT" ? "" : locale + "/";
      const html = await readFile("dist/" + suffix + "index.html", "utf8");
      for (const client of [context, friend]) {
        await client.route("**/*", route => route.fulfill({ contentType: "text/html", body: html }));
        await client.addInitScript(() => {
          window.shared = [];
          Object.defineProperty(navigator, "canShare", { value: () => true });
          Object.defineProperty(navigator, "share", { value: async data => window.shared.push(data) });
        });
      }
      const page = await context.newPage();
      const readSave = page => page.evaluate(locale => JSON.parse(localStorage.getItem(`matiz.${locale}.v1`)), locale);
      const answerCorrectly = async page => {
        const { survival } = await readSave(page);
        const index = survival.cards[survival.cursor].options.indexOf(survival.cards[survival.cursor].key);
        await page.locator(".choice").nth(index).click();
        await page.locator('[data-action="next"]').click();
      };
      await page.goto("https://matiz.test/jogar/" + suffix);
      await page.locator('[data-action="start"]').click();
      const practice = (await readSave(page)).session;
      await page.locator('[data-action="home"]').click();
      await page.locator('[data-action="survival"]').click();
      await page.locator('[data-action="accept-survival"]').click();
      assert.equal(await page.locator(".steps").count(), 0);
      const cards = (await readSave(page)).survival.cards;
      await answerCorrectly(page);
      await page.reload();
      assert.equal((await readSave(page)).survival.cursor, 1);
      await page.locator('[data-action="home"]').click();
      await page.locator('[data-action="survival"]').click();
      for (let i = 1; i < 4; i++) await answerCorrectly(page);
      await page.locator('[data-action="unsure"]').click();
      await page.reload();
      assert.ok(await page.locator(".feedback").isVisible());
      await page.locator('[data-action="next"]').click();
      assert.equal(await page.locator(".score").innerText(), "4");
      assert.equal(await page.locator('[data-stat="yourBest"]').innerText(), "4");
      assert.deepEqual((await readSave(page)).session, practice);
      assert.deepEqual((await readSave(page)).progress, {});
      await page.locator('[data-action="share"]').click();
      const text = await page.evaluate(() => window.shared[0].text);
      const link = text.split("\n").at(-1);
      await checkSharedImage(page, "survival-card-" + locale);
      assert.equal(new URL(link).pathname.endsWith("/jogar/" + suffix), true);
      const other = await friend.newPage();
      await other.goto(link);
      assert.match(await other.locator(".challenge-target").innerText(), /4/);
      await other.reload();
      await other.locator('[data-action="accept-survival"]').click();
      assert.equal(await other.locator('[data-stat="currentScore"]').innerText(), "0");
      assert.equal(await other.locator('[data-stat="yourBest"]').innerText(), "0");
      assert.equal(await other.locator('[data-stat="challenger"]').innerText(), "4");
      assert.deepEqual((await readSave(other)).survival.cards, cards);
      assert.equal(new URL(other.url()).search, "");
      for (let i = 0; i < 5; i++) await answerCorrectly(other);
      const { survival } = await readSave(other);
      const card = survival.cards[survival.cursor];
      await other.locator(".choice").nth(card.options.findIndex(option => option !== card.key)).click();
      await other.locator('[data-action="next"]').click();
      assert.equal(await other.locator(".score").innerText(), "5");
      assert.equal(await other.locator('[data-stat="yourBest"]').innerText(), "5");
      assert.equal(await other.locator('[data-stat="challenger"]').innerText(), "4");
      assert.match(await other.locator(".summary").innerText(), locale === "pt-PT" ? /Superaste 4/ : /You beat 4/);
      assert.ok(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (process.env.MATIZ_SCREENSHOTS) {
        await mkdir(process.env.MATIZ_SCREENSHOTS, { recursive: true });
        await other.screenshot({ path: path.join(process.env.MATIZ_SCREENSHOTS, "survival-" + locale + ".png") });
      }
      await other.locator('[data-action="new-survival"]').click();
      const pending = (await readSave(other)).survival;
      assert.equal(await other.locator('[data-stat="currentScore"]').innerText(), "0");
      assert.equal(await other.locator('[data-stat="yourBest"]').innerText(), "5");
      assert.equal(await other.locator('[data-stat="challenger"]').count(), 0);
      assert.notEqual(pending.seed, survival.seed);
      const badLink = new URL(link);
      badLink.searchParams.set("v", "s1-00000000");
      await other.goto(badLink.href);
      assert.equal(await other.locator('[data-action="accept-survival"]').count(), 0);
      await other.locator('[data-action="home"]').click();
      assert.deepEqual((await readSave(other)).survival, pending);
      await other.goto(link);
      assert.equal(await other.locator('[data-action="accept-survival"]').innerText(),
        locale === "pt-PT" ? "Ver resultado\n→" : "View result\n→");
      await other.locator('[data-action="home"]').click();
      await other.locator('[data-action="survival"]').click();
      assert.deepEqual((await readSave(other)).survival, pending);
      await other.goto(link);
      await other.locator('[data-action="accept-survival"]').click();
      assert.equal(await other.locator(".score").innerText(), "5");
      assert.equal(await other.locator(".choice").count(), 0);
      await other.locator('[data-action="share"]').click();
      const originalShare = await other.evaluate(() => window.shared[0].text);
      assert.equal(new URL(originalShare.split("\n").at(-1)).searchParams.get("score"), "5");
      await checkSharedImage(other, "challenged-card-" + locale);
      // A later shorter run keeps the best and shares its own score, not the record.
      await other.locator('[data-action="new-survival"]').click();
      await other.locator('[data-action="unsure"]').click();
      await other.locator('[data-action="next"]').click();
      assert.equal(await other.locator('[data-stat="yourBest"]').innerText(), "5");
      await other.locator('[data-action="share"]').click();
      const lowerLink = await checkSharedImage(other, "lower-score-card-" + locale);
      assert.equal(new URL(lowerLink).searchParams.get("score"), "0");
    } finally {
      await context.close();
      await friend.close();
    }
  }
  console.log("Survival: both languages, resume, failure, friend invitation, identical cards, score comparison and incompatible links passed.");
}

/** Open a retired question offline after its replacement has shipped. */
export async function testArchivedSurvival(browser) {
  const fixture = await languageFixture();
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  try {
    await buildGames(fixture);
    const oldVersion = survivalVersion(gameLevels(fixturePack));
    const revised = structuredClone(fixturePack);
    Object.assign(revised.levels[0].words[0], {
      id: "reflect", word: "reflect", answer: "think", example: "She took a moment to reflect on the question.",
    });
    await writeFile(path.join(fixture.root, "packs/en-GB.json"), JSON.stringify(revised));
    await buildGames(fixture);
    await context.setOffline(true);
    const page = await context.newPage();
    const link = pathToFileURL(path.join(fixture.outdir, "en-GB/index.html")).href + `?mode=survival&seed=9&v=${oldVersion}&score=1`;
    await page.goto(link);
    await page.locator('[data-action="accept-survival"]').click();
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await page.locator(".question h1").innerText(), "ponder");
    await page.locator('[data-action="unsure"]').click();
    assert.equal(await page.locator(".meaning").innerText(), "consider");
    await page.locator('[data-action="next"]').click();
    assert.equal(await page.locator(".score").innerText(), "0");
    assert.equal(await page.locator('[data-action="new-survival"]').innerText(), "Play again");
    await page.locator('[data-action="new-survival"]').click();
    await page.reload();
    assert.equal(await page.locator(".question h1").innerText(), "reflect");
    await page.goto(link);
    await page.locator('[data-action="accept-survival"]').click();
    assert.equal(await page.locator(".score").innerText(), "0");
    assert.equal(await page.locator(".choice").count(), 0);
    console.log("Archived Survival: removed words remain playable and first results survive later runs.");
  } finally {
    await context.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
}
