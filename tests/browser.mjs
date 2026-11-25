// A new browser context is used on desktop. CDP mode expects a fresh test emulator.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";
import { practiceLevels, wordsById } from "../src/game.js";
import { testLanguages } from "./languages-browser.mjs";
import { testDailySharing } from "./share-browser.mjs";
import { testSurvival, testArchivedSurvival } from "./survival-browser.mjs";

const remote = process.env.MATIZ_CDP;
const browser = remote
  ? await chromium.connectOverCDP(remote, { noDefaults: true })
  : await chromium.launch({
      executablePath: process.env.MATIZ_BROWSER || undefined,
    });
try {
  const levels = practiceLevels();
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
  if (!remote) {
    // Older Android WebViews can parse the bundle without providing structuredClone.
    await page.addInitScript(() => { window.structuredClone = undefined; });
    await page.goto(pathToFileURL(path.resolve("dist/index.html")).href);
  }
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
  assert.equal(await page.locator(".band").count(), levels.length);
  await page.locator(".band summary").first().click();
  const entry = page.locator(".band").first();
  assert.equal(await entry.locator("li").count(), levels[0].words.length);
  assert.match(await entry.innerText(), /Por descobrir/);
  await entry.locator("summary").click();
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
  assert.equal(await page.locator(".word-stage").innerText(), "Em aprendizagem");
  assert.equal(await page.locator(".stage-track .filled").count(), 2);
  await capture("feedback");
  await page.reload();
  await page.locator(".feedback").waitFor();
  assert.equal(await h1.innerText(), first);
  await page.locator(".back").click();
  await page.locator(".hero .primary").click();
  assert.equal(await h1.innerText(), first);
  await page.locator(".primary").click();
  let correctInRound = 0;
  while (!(await page.locator(".summary").count())) {
    const headword = await h1.innerText();
    const word = levels[0].words.find(w => w.word === headword);
    assert.ok(word && word.levelId === levels[0].id);
    const i = await page
      .locator(".choice")
      .evaluateAll(
        (choices, key) =>
          choices.findIndex((el) => el.lastChild.textContent === key),
        word.key,
      );
    assert.ok(i >= 0);
    await page.locator(".choice").nth(i).click();
    assert.equal(await page.locator(".result").innerText(), "Certo!");
    correctInRound++;
    if (correctInRound <= 4) {
      assert.equal(await page.locator(".answer-run").getAttribute("data-tier"), correctInRound <= 3 ? "low" : "mid");
    }
    if (correctInRound === 2) {
      const bolt = page.locator(".answer-run", { hasText: "2" });
      const badge = await bolt.boundingBox();
      const result = await page.locator(".result").boundingBox();
      assert.ok(badge && badge.x > result.x + result.width);
      assert.ok(Math.abs((badge.y + badge.height / 2) - (result.y + result.height / 2)) <= 1);
      assert.ok(await bolt.evaluate(el => el.classList.contains("run-increased")));
      assert.equal(await bolt.locator(".run-count").getAttribute("data-previous"), "1");
      assert.equal(await bolt.locator(".run-count > span").textContent(), "2");
      await bolt.click();
      assert.ok(await page.getByText("2 seguidas. Continua!").isVisible());
      await page.keyboard.press("Escape");
      assert.equal(await page.getByText("2 seguidas. Continua!").isVisible(), false);
      await page.reload();
      assert.equal(await bolt.evaluate(el => el.classList.contains("run-increased")), false);
    }
    assert.ok(await page.locator(".review-time").isVisible());
    await page.locator(".primary").click();
  }
  assert.match(await page.locator(".score").innerText(), /4\s*\/\s*5/);
  await tap("Voltar ao início");
  await entry.locator("summary").click();
  assert.ok(
    (await entry.innerText()).includes(
      "5 de " + levels[0].words.length + " vistas",
    ),
  );
  assert.equal(
    await entry.locator("li").filter({ hasText: "Em aprendizagem" }).count(),
    5,
  );
  await page.locator(".hero .primary").click();
  await page.locator(".choice").first().waitFor();
  if (!remote) {
    // Model an update of the installed game while the old answer screen is open.
    const legacy = wordsById.get("renitente");
    const later = wordsById.get("tergiversar");
    const yesterday = Date.now() - 2 * 86_400_000;
    await page.evaluate(
      ({ legacy, later, yesterday }) => {
        localStorage.setItem(
          "matiz.pt-PT.v1",
          JSON.stringify({
            version: 1,
            active: "1",
            progress: {
              [legacy.id]: {
                termId: legacy.id,
                setId: "1",
                seen: 1,
                box: 1,
                correct: 1,
                incorrect: 0,
                lastSeen: Date.now(),
              },
              [later.id]: {
                termId: later.id,
                setId: "3",
                seen: 1,
                box: 0,
                correct: 0,
                incorrect: 1,
                lastSeen: yesterday,
              },
            },
            sessions: {
              1: {
                cards: [{ id: legacy.id, options: legacy.choices }],
                cursor: 0,
                answers: [legacy.key],
                replay: false,
              },
            },
          }),
        );
      },
      { legacy, later, yesterday },
    );
    await page.reload();
    await page.locator(".feedback").waitFor();
    assert.equal(await h1.innerText(), legacy.word);
    await page.locator(".primary").click();
    await page.locator(".summary").waitFor();
    await page.locator(".primary").click();
    assert.equal(await h1.innerText(), later.word);
    assert.equal(await page.locator(".difficulty").innerText(), "Difícil");
    console.log(
      "Upgrade: answered legacy card resumes and an older hard word returns before unseen entry words.",
    );
  }
  console.log(
    "Mobile flow: collection, entry round, feedback, resume, score and next round passed.",
  );
  if (!remote) {
    const word = wordsById.get("ponderar");
    await page.evaluate(word => {
      localStorage.setItem("matiz.pt-PT.v1", JSON.stringify({
        version: 2, active: false, session: null,
        progress: { [word.id]: { seen: 3, correct: 3, delayedReviews: 2, reviewStep: 2, dueAt: 0 } },
      }));
    }, word);
    await page.reload();
    await page.locator(".hero .primary").click();
    await page.evaluate(() => {
      const key = "matiz.pt-PT.v1", saved = JSON.parse(localStorage.getItem(key));
      saved.session.cards = saved.session.cards.slice(0, 1);
      localStorage.setItem(key, JSON.stringify(saved));
    });
    await page.reload();
    assert.equal(await h1.innerText(), "Completa a frase");
    assert.equal(await page.locator(".choice").count(), 0);
    const input = page.getByRole("textbox", { name: "Palavra em falta" });
    await input.fill("outra");
    await tap("Confirmar");
    assert.match(await page.getByRole("status").filter({ hasText: "Tenta outra" }).innerText(), /vê as opções/);
    await input.fill(word.word);
    await tap("Confirmar");
    assert.equal(await page.locator(".word-stage").innerText(), "Consolidada · Revisão");
    assert.equal(await page.locator(".stage-track .filled").count(), 4);
    const stage = page.locator(".word-stage");
    assert.ok(await stage.evaluate(el => el.classList.contains("stage-advanced")));
    const tip = stage.locator(".stage-tip");
    assert.equal(await tip.isVisible(), false);
    await stage.locator("summary").click();
    assert.match(await tip.innerText(), /3 revisões espaçadas/);
    assert.equal(await tip.isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await tip.isVisible(), false);
    assert.equal(await stage.locator("summary").evaluate(el => el === document.activeElement), true);

    await tap("Ver resultado");
    const collection = page.locator(".collection-progress");
    assert.equal(await collection.locator(".round-gains").innerText(), "+1 consolidada");
    assert.equal(await collection.locator("dt").first().innerText(), "Consolidadas");
    assert.deepEqual((await collection.locator("dd").allTextContents()).slice(0, 3), ["1", "0", "0"]);
    await collection.locator(".collection-bar .retained").waitFor({ state: "visible" });
    await page.reload();
    assert.equal(await collection.locator("dd").first().innerText(), "1");

    await page.evaluate(() => {
      const key = "matiz.pt-PT.v1", saved = JSON.parse(localStorage.getItem(key));
      saved.session.cursor = 0;
      saved.session.answers = [];
      localStorage.setItem(key, JSON.stringify(saved));
    });
    await page.reload();
    await tap("Ver opções");
    assert.equal(await h1.innerText(), word.word);
    assert.equal(await page.locator(".choice").count(), 4);
    await testLanguages(browser);
    await testDailySharing(browser);
    await testSurvival(browser);
    await testArchivedSurvival(browser);
  }
} finally {
  await browser.close();
}
