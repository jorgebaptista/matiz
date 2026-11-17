import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

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
      assert.deepEqual((await readSave(page)).session, practice);
      assert.deepEqual((await readSave(page)).progress, {});
      await page.locator('[data-action="share"]').click();
      const text = await page.evaluate(() => window.shared[0].text);
      const link = text.split("\n").at(-1);
      assert.equal(new URL(link).pathname.endsWith("/jogar/" + suffix), true);
      const other = await friend.newPage();
      await other.goto(link);
      assert.match(await other.locator(".challenge-target").innerText(), /4/);
      await other.reload();
      await other.locator('[data-action="accept-survival"]').click();
      assert.deepEqual((await readSave(other)).survival.cards, cards);
      assert.equal(new URL(other.url()).search, "");
      for (let i = 0; i < 5; i++) await answerCorrectly(other);
      const { survival } = await readSave(other);
      const card = survival.cards[survival.cursor];
      await other.locator(".choice").nth(card.options.findIndex(option => option !== card.key)).click();
      await other.locator('[data-action="next"]').click();
      assert.equal(await other.locator(".score").innerText(), "5");
      assert.match(await other.locator(".summary").innerText(), locale === "pt-PT" ? /Superaste 4/ : /You beat 4/);
      assert.ok(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (process.env.MATIZ_SCREENSHOTS) {
        await mkdir(process.env.MATIZ_SCREENSHOTS, { recursive: true });
        await other.screenshot({ path: path.join(process.env.MATIZ_SCREENSHOTS, "survival-" + locale + ".png") });
      }
      await other.locator('[data-action="new-survival"]').click();
      const pending = (await readSave(other)).survival;
      const badLink = new URL(link);
      badLink.searchParams.set("v", "s1-00000000");
      await other.goto(badLink.href);
      assert.equal(await other.locator('[data-action="accept-survival"]').count(), 0);
      await other.locator('[data-action="home"]').click();
      assert.deepEqual((await readSave(other)).survival, pending);
      await other.goto(link);
      assert.equal(await other.locator('[data-action="accept-survival"]').innerText(),
        locale === "pt-PT" ? "Substituir partida atual\n→" : "Replace current run\n→");
      await other.locator('[data-action="home"]').click();
      await other.locator('[data-action="survival"]').click();
      assert.deepEqual((await readSave(other)).survival, pending);
    } finally {
      await context.close();
      await friend.close();
    }
  }
  console.log("Survival: both languages, resume, failure, friend invitation, identical cards, score comparison and incompatible links passed.");
}
