import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkSharedImage } from "./share-image-helper.mjs";

/** Check PNG sharing, cancellation, downloads and links in both daily editions. */
export async function testDailySharing(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  try {
    for (const locale of ["pt-PT", "en-GB"]) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const suffix = locale === "pt-PT" ? "" : locale + "/";
      const html = await readFile("dist/" + suffix + "index.html", "utf8");
      await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: html }));
      await page.clock.setFixedTime(new Date("2026-11-17T12:00:00Z"));
      await page.addInitScript(() => {
        const today = Date.UTC(2026, 10, 17) / 86_400_000;
        for (let i = 1; i <= 6; i++) localStorage.setItem("matiz.daily-day." + (today - i), "1");
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        window.flameNumbers = [];
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
          if (this.fillStyle === "#472209") window.flameNumbers.push(text);
          return fillText.call(this, text, ...args);
        };
      });
      await page.goto("https://matiz.test/jogar/" + suffix + "?mode=daily");
      assert.equal(await page.locator('[data-action="share"]').count(), 0);
      for (let index = 0; index < 4; index++) {
        const correct = await page.evaluate(locale => {
          const daily = JSON.parse(localStorage.getItem(`matiz.${locale}.v1`)).daily;
          return daily.cards[daily.cursor].key;
        }, locale);
        if (index === 2) await page.locator('[data-action="unsure"]').click();
        else {
          const choice = await page.locator(".choice").evaluateAll((choices, key) =>
            choices.findIndex(el => el.lastChild.textContent === key), correct);
          await page.locator(".choice").nth(choice).click();
        }
        await page.locator('[data-action="next"]').click();
      }
      assert.match(await page.locator(".score").innerText(), /3\s*\/\s*4/);
      await page.reload();
      const share = page.locator('[data-action="share"]');
      assert.equal(await share.textContent(), locale === "pt-PT" ? "Partilhar resultado↗" : "Share result↗");
      const saved = await page.evaluate(locale => localStorage.getItem(`matiz.${locale}.v1`), locale);
      await page.evaluate(() => {
        window.shared = [];
        window.copied = [];
        Object.defineProperty(navigator, "canShare", { configurable: true, value: data => data.files?.[0]?.type === "image/png" });
        Object.defineProperty(navigator, "share", { configurable: true, value: async data => window.shared.push(data) });
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => window.copied.push(text) } });
      });
      await share.click();
      await page.waitForFunction(() => window.shared.length === 1);
      const text = await page.evaluate(() => window.shared[0].text);
      assert.equal(text, new URL(text).href); // Caption is just the playable link.
      const base = (process.env.SITE_URL || "https://jorgebaptista.github.io/matiz").replace(/\/+$/, "");
      assert.equal(text, base + "/daily/" + locale + "/");
      const stored = JSON.parse(saved).daily;
      for (const card of stored.cards) assert.ok(!text.includes(card.key));
      await checkSharedImage(page, "daily-card-" + locale);
      assert.equal(await page.evaluate(() => window.flameNumbers.at(-1)), "7");

      await page.evaluate(() => Object.defineProperty(navigator, "share", {
        configurable: true, value: async () => { throw new DOMException("Cancelled", "AbortError"); },
      }));
      await share.click();
      await page.waitForFunction(() => !document.querySelector('[data-action="share"]').disabled);
      assert.equal(await page.locator(".share-status").innerText(), "");
      assert.deepEqual(await page.evaluate(() => window.copied), []);
      assert.equal(await page.locator(".share-fallback").isVisible(), false);

      // A browser may support text sharing but not image files.
      await page.evaluate(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: async data => window.shared.push(data) });
        Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
      });
      await share.click();
      assert.ok(await page.locator(".share-fallback").isVisible());
      assert.equal(await page.evaluate(() => window.shared.length), 1);

      await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
      await share.click();
      assert.ok(await page.locator(".share-preview").isVisible());
      const downloaded = page.waitForEvent("download");
      await page.locator("[data-download]").click();
      assert.equal((await downloaded).suggestedFilename(), `matiz-daily-${locale}.png`);
      await page.locator('[data-action="copy-link"]').click();
      await page.waitForFunction(() => window.copied.length === 1);
      assert.equal(await page.evaluate(() => window.copied[0]), text.split("\n").at(-1));
      assert.equal(await page.locator(".share-status").innerText(), locale === "pt-PT" ? "Ligação copiada" : "Link copied");

      await page.evaluate(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new Error("Blocked"); } });
        Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
        navigator.clipboard.writeText = async () => { throw new Error("Blocked"); };
      });
      await share.click();
      await page.locator('[data-action="copy-link"]').click();
      assert.ok(await page.locator(".share-text").isVisible());
      assert.equal(await page.locator(".share-text").inputValue(), text.split("\n").at(-1));
      assert.equal(await page.evaluate(locale => localStorage.getItem(`matiz.${locale}.v1`), locale), saved);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log("Daily sharing: both editions, PNG attachments, playable links, cancellation, image download and link fallbacks passed.");
  } finally {
    await context.close();
  }
}
