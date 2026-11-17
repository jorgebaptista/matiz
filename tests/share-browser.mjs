import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Check sharing, cancellation and copy fallback through both editions' daily flow. */
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
        Object.defineProperty(navigator, "share", { configurable: true, value: async data => window.shared.push(data) });
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => window.copied.push(text) } });
      });
      await share.click();
      await page.waitForFunction(() => window.shared.length === 1);
      const text = await page.evaluate(() => window.shared[0].text);
      assert.match(text, /🟩🟩⬜🟩 3\/4/);
      assert.ok(text.includes(locale));
      const base = (process.env.SITE_URL || "https://jorgebaptista.github.io/matiz").replace(/\/+$/, "");
      assert.ok(text.endsWith(base + "/jogar/" + suffix + "?mode=daily"));
      const stored = JSON.parse(saved).daily;
      for (const card of stored.cards) assert.ok(!text.includes(card.key));

      await page.evaluate(() => Object.defineProperty(navigator, "share", {
        configurable: true, value: async () => { throw new DOMException("Cancelled", "AbortError"); },
      }));
      await share.click();
      assert.equal(await page.locator(".share-status").innerText(), "");
      assert.deepEqual(await page.evaluate(() => window.copied), []);

      await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
      await share.click();
      await page.waitForFunction(() => window.copied.length === 1);
      assert.equal(await page.evaluate(() => window.copied[0]), text);
      assert.equal(await page.locator(".share-status").innerText(), locale === "pt-PT" ? "Resultado copiado" : "Result copied");

      await page.evaluate(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new Error("Blocked"); } });
        navigator.clipboard.writeText = async () => { throw new Error("Blocked"); };
      });
      await share.click();
      assert.ok(await page.locator(".share-text").isVisible());
      assert.equal(await page.locator(".share-text").inputValue(), text);
      assert.equal(await page.evaluate(locale => localStorage.getItem(`matiz.${locale}.v1`), locale), saved);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log("Daily sharing: both editions, saved results, native API, cancellation and copy fallbacks passed.");
  } finally {
    await context.close();
  }
}
