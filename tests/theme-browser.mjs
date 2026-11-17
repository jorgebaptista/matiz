import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/** Exercise theme preferences across the website, editions and active rounds. */
export async function testTheme(browser, url) {
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 320, height: 740 } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const theme = () => page.locator("html").getAttribute("data-theme");
  const toggle = () => page.locator("[data-theme-toggle]");
  const screenshot = async name => {
    if (!process.env.MATIZ_THEME_SCREENSHOTS) return;
    await mkdir(process.env.MATIZ_THEME_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.MATIZ_THEME_SCREENSHOTS, name + ".png"), fullPage: true });
  };
  try {
    for (const route of ["", "editions/pt-PT/", "editions/en-GB/", "jogar/", "jogar/en-GB/"]) {
      await page.goto(url + route);
      assert.equal(await theme(), "dark", route);
      assert.equal(await toggle().getAttribute("aria-pressed"), "true");
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), "rgb(20, 35, 30)");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, route + " overflow");
      await checkContrast(page, "body, .hero, .primary, .daily, .survival, .number, .level-text small, aside, .play, a");
    }
    await screenshot("Matiz-dark-home");
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    await toggle().focus();
    await page.keyboard.press("Space");
    assert.equal(await theme(), "dark");
    await page.reload();
    assert.equal(await theme(), "dark", "explicit preference survives reload and overrides the OS");

    await page.getByRole("button", { name: "Play", exact: true }).click();
    const heading = await page.locator(".question h1").innerText();
    const saved = await page.evaluate(() => localStorage.getItem("matiz.en-GB.v1"));
    await toggle().click();
    assert.equal(await theme(), "light");
    assert.equal(await page.locator(".question h1").innerText(), heading);
    assert.equal(await page.evaluate(() => localStorage.getItem("matiz.en-GB.v1")), saved, "theme must not alter progress");
    await checkContrast(page, ".choice, .choice span, .difficulty, .primary");
    await toggle().click();
    await checkContrast(page, ".choice, .choice span, .difficulty, .primary");
    await screenshot("Matiz-dark-question");
    await page.getByRole("button", { name: "I don't know", exact: true }).click();
    await checkContrast(page, ".result, .meaning, .example, .example h2, .primary");
    await screenshot("Matiz-dark-feedback");

    const other = await context.newPage();
    await other.goto(url + "jogar/");
    assert.equal(await other.locator("html").getAttribute("data-theme"), "dark", "shared across editions");
    assert.equal(await other.locator("[data-theme-toggle]").getAttribute("aria-label"), "Modo escuro");
    await other.locator("[data-theme-toggle]").click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    await other.evaluate(() => localStorage.removeItem("matiz.theme"));
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");

    await page.goto(url + "jogar/?mode=daily");
    for (let i = 0; i < 4; i++) {
      await checkContrast(page, ".difficulty, .choice, .choice span");
      await page.getByRole("button", { name: "Não sei", exact: true }).click();
      await checkContrast(page, ".result, .meaning, .example");
      await page.locator('[data-action="next"]').click();
    }
    await screenshot("Matiz-dark-daily");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(url);
    await screenshot("Matiz-dark-website");
  } finally { await context.close(); }

  const blocked = await browser.newContext({ colorScheme: "dark" });
  try {
    await blocked.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
      Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    });
    const page = await blocked.newPage();
    await page.goto(url + "jogar/");
    await page.locator("[data-theme-toggle]").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    assert.ok(await page.locator(".hero").isVisible(), "blocked storage must not break the game");
  } finally { await blocked.close(); }

  const noScript = await browser.newContext({ colorScheme: "dark", javaScriptEnabled: false });
  try {
    const page = await noScript.newPage();
    await page.goto(url);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), "rgb(20, 35, 30)");
    assert.equal(await page.locator("[data-theme-toggle]").isVisible(), false);
  } finally { await noScript.close(); }
  console.log("Theme: system preference, persistence, language navigation, keyboard, contrast and storage fallback passed.");
}

async function checkContrast(page, selector) {
  const failures = await page.locator(selector).evaluateAll(elements => {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => {
      const c = value / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    return elements.filter(el => el.getClientRects().length && el.textContent.trim()).flatMap(el => {
      const style = getComputedStyle(el);
      let parent = el;
      let background;
      while (parent) {
        background = getComputedStyle(parent).backgroundColor;
        if (background !== "rgba(0, 0, 0, 0)" && background !== "transparent") break;
        parent = parent.parentElement;
      }
      const a = luminance(style.color), b = luminance(background);
      const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      return ratio < 4.5 ? [{ selector: el.className || el.tagName, ratio }] : [];
    });
  });
  assert.deepEqual(failures, [], "text contrast must be at least 4.5:1");
}
