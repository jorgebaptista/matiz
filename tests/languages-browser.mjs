import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildGames } from "../scripts/build.mjs";
import { languageFixture } from "./language-fixture.mjs";

/** Exercise disposable translations offline and prove same-origin save isolation. */
export async function testLanguages(browser) {
  const fixture = await languageFixture();
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  try {
    // Leave Fisher-Yates order unchanged so the Portuguese save uses the shared ID.
    await context.addInitScript(() => { Math.random = () => 0.999999; });
    await buildGames(fixture);
    const enFile = path.join(fixture.outdir, "en-GB/index.html");
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.setOffline(true);
    await page.goto(pathToFileURL(enFile).href);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    assert.equal(await page.locator(".question p").innerText(), "Which meaning is closest?");
    await page.getByRole("button", { name: "I don't know", exact: true }).click();
    assert.equal(await page.locator(".result").innerText(), "Good to know");
    assert.match(await page.locator(".review-time").innerText(), /5 other questions/);
    await page.reload();
    assert.equal(await page.locator(".example blockquote").innerText(), "She paused to ponder the two options.");
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem("matiz.en-GB.v1"));
      saved.progress.ponderar.questionsLeft = 1;
      localStorage.setItem("matiz.en-GB.v1", JSON.stringify(saved));
    });
    await page.reload();
    assert.match(await page.locator(".review-time").innerText(), /1 other question,/);

    // Fulfil both pages locally at one origin; no server or external requests.
    const htmlByPath = new Map([
      ["/jogar/", await readFile(path.join(fixture.outdir, "index.html"), "utf8")],
      ["/jogar/en-GB/", await readFile(enFile, "utf8")],
    ]);
    const unexpectedRequests = [];
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const html = url.origin === "https://matiz.test" && htmlByPath.get(url.pathname);
      if (html) await route.fulfill({ contentType: "text/html", body: html });
      else {
        unexpectedRequests.push(url.href);
        await route.abort();
      }
    });
    await page.goto("https://matiz.test/jogar/");
    await page.locator(".hero .primary").click();
    await page.getByRole("button", { name: "Não sei", exact: true }).click();
    const ptSave = await page.evaluate(() => localStorage.getItem("matiz.pt-PT.v1"));
    assert.equal(JSON.parse(ptSave).progress.ponderar.seen, 1);
    const ptWord = await page.locator("h1").innerText();
    await page.goto("https://matiz.test/jogar/en-GB/");
    assert.equal(await page.title(), "Matiz · Synonyms");
    assert.equal(await page.locator("html").getAttribute("lang"), "en-GB");
    assert.equal(await page.locator(".locale").innerText(), "British English");
    assert.equal(await page.locator(".hero .primary").textContent(), "Play→");
    assert.match(await page.locator(".credits").innerText(), /Credits and licences/);
    await page.locator(".hero .primary").click();
    assert.equal(await page.locator("h1").innerText(), "ponder");
    await page.locator(".choice").filter({ hasText: "consider" }).click();
    assert.equal(await page.locator(".result").innerText(), "Correct!");
    assert.equal(await page.locator(".example h2").innerText(), "Example");
    const enSave = await page.evaluate(() => localStorage.getItem("matiz.en-GB.v1"));
    assert.equal(JSON.parse(enSave).progress.ponderar.seen, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem("matiz.pt-PT.v1")), ptSave);
    await page.reload();
    assert.equal(await page.locator(".result").innerText(), "Correct!");
    await page.getByRole("button", { name: "View result", exact: true }).click();
    assert.equal(await page.locator("h1").innerText(), "Round complete");
    await page.getByRole("button", { name: "Back home", exact: true }).click();
    await page.locator(".band summary").click();
    assert.match(await page.locator(".band").innerText(), /1 of 1 seen/);
    assert.match(await page.locator(".band").innerText(), /Learning/);
    const enFinished = await page.evaluate(() => localStorage.getItem("matiz.en-GB.v1"));
    await page.goto("https://matiz.test/jogar/");
    assert.equal(await page.locator("h1").innerText(), ptWord);
    assert.equal(await page.locator(".result").innerText(), "Fica a saber");
    assert.equal(await page.evaluate(() => localStorage.getItem("matiz.en-GB.v1")), enFinished);
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedRequests, []);
    console.log("Language fixture: translated offline play, plurals, resume, credits and same-origin save isolation passed.");
  } finally {
    await context.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
}
