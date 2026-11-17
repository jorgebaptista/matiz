// A new browser context is used on desktop. CDP mode expects a fresh test emulator.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";
import { levels } from "../src/game.js";

const remote = process.env.MATIZ_CDP;
const browser = remote
  ? await chromium.connectOverCDP(remote, { noDefaults: true })
  : await chromium.launch({
      executablePath: process.env.MATIZ_BROWSER || undefined,
    });
try {
  const context = remote
    ? browser.contexts()[0]
    : await browser.newContext({
        viewport: { width: 390, height: 800 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        locale: "pt-PT",
      });
  const page = remote
    ? context.pages().find((p) => p.url().includes("android_asset"))
    : await context.newPage();
  assert.ok(page, "Expected the Matiz WebView");
  if (!remote)
    await page.goto(pathToFileURL(path.resolve("dist/index.html")).href);
  page.setDefaultTimeout(6000);
  const button = (name) => page.getByRole("button", { name, exact: true });
  const tap = (name) => button(name).click();
  const h1 = page.getByRole("heading", { level: 1 });
  async function capture(name) {
    if (process.env.MATIZ_SCREENSHOTS) {
      await mkdir(process.env.MATIZ_SCREENSHOTS, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.MATIZ_SCREENSHOTS, name + ".png"),
      });
    }
  }
  await page.locator(".hero").waitFor();
  assert.equal(
    await page.locator(".level:disabled").count(),
    levels.length - 1,
  );
  await capture("levels");
  await page.locator(".hero .primary").click();
  await page.locator(".choice").first().waitFor();
  const first = await h1.innerText();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.ok((await page.locator(".choice").first().boundingBox()).height >= 44);
  await capture("question");
  await tap("Não sei");
  await page.locator(".result").waitFor();
  assert.equal(await page.locator(".result").innerText(), "Fica a saber");
  await capture("feedback");
  await page.reload();
  await page.locator(".feedback").waitFor();
  assert.equal(await h1.innerText(), first);
  await page.locator(".back").click();
  await page.locator(".hero .primary").click();
  assert.equal(await h1.innerText(), first);
  await page.locator(".primary").click();
  let lastScore = 0;
  while (!(await h1.innerText().then((v) => v === "Nível concluído!"))) {
    if (await page.locator(".summary").count()) {
      await page.locator(".primary").click();
      continue;
    }
    const target = await h1.innerText();
    const word = levels[0].words.find((w) => w.word === target);
    assert.ok(word, target);
    await page.locator(".choice").filter({ hasText: word.key }).first().click();
    assert.equal(await page.locator(".result").innerText(), "Certo!");
    await page.locator(".primary").click();
    assert.ok(
      ++lastScore < levels[0].words.length * 3 + 5,
      "Level must be completable",
    );
  }
  await page.locator(".primary").click();
  assert.match(await page.locator(".eyebrow").innerText(), /Nível 2/i);
  await page.locator(".back").click();
  assert.equal(
    await page.locator(".level:disabled").count(),
    levels.length - 2,
  );
  console.log(
    (remote ? "Android WebView" : "Mobile browser") +
      ": skip, feedback, reload, resume, full first level and unlock passed.",
  );
} finally {
  await browser.close();
}
