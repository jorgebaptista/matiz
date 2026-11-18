// Verify the deployable site under a project path, even with scripting disabled.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { projectRoot } from "../scripts/content.mjs";
import { testTheme } from "./theme-browser.mjs";

const prefix = "/matiz/";
const root = path.join(projectRoot, "site-dist");
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".xml": "application/xml",
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const rel =
    pathname.slice(prefix.length) +
    (pathname.endsWith("/") ? "index.html" : "");
  const file = path.resolve(root, rel);
  if (pathname.startsWith(prefix) && file.startsWith(root + path.sep)) {
    try {
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": contentTypes[path.extname(file)] });
      res.end(data);
      return;
    } catch {}
  }
  res.writeHead(404).end();
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
let browser;
try {
  const url = "http://127.0.0.1:" + server.address().port + prefix;
  browser = await chromium.launch({
    executablePath: process.env.MATIZ_BROWSER || undefined,
  });
  await testTheme(browser, url);
  const staticPage = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 800 },
  });
  await staticPage.goto(url);
  assert.match(await staticPage.title(), /daily word game/i);
  assert.equal(await staticPage.locator("html").getAttribute("lang"), "en");
  const info = staticPage.getByRole("link", {
    name: "About Português europeu",
  });
  assert.equal(await info.getAttribute("href"), "./editions/pt-PT/");
  assert.equal(
    await staticPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  assert.ok((await staticPage.request.get(url + "matiz.png")).ok());
  if (process.env.SITE_URL) {
    const base = new URL(process.env.SITE_URL.replace(/\/+$/, "") + "/");
    assert.equal(
      await staticPage.locator('link[rel="canonical"]').getAttribute("href"),
      base.href,
    );
    assert.equal(
      await staticPage
        .locator('meta[property="og:image"]')
        .getAttribute("content"),
      new URL("matiz.png", base).href,
    );
    const sitemap = await staticPage.request.get(url + "sitemap.xml");
    assert.ok(sitemap.ok());
    assert.ok(
      (await sitemap.text()).includes(
        "<loc>" + new URL("jogar/", base).href + "</loc>",
      ),
    );
  }
  for (const [locale, name] of [["en-GB", "British English"], ["pt-PT", "Português europeu"]]) {
    await staticPage.getByRole("link", { name: "Play today’s four words in " + name }).click();
    assert.equal(staticPage.url(), url + "daily/" + locale + "/");
    assert.ok(await staticPage.locator(".daily-info p").isVisible());
    if (process.env.SITE_URL) {
      const canonical = new URL("daily/" + locale + "/", process.env.SITE_URL.replace(/\/+$/, "") + "/").href;
      assert.equal(await staticPage.locator('link[rel="canonical"]').getAttribute("href"), canonical);
      assert.equal(await staticPage.locator('meta[property="og:url"]').getAttribute("content"), canonical);
      assert.equal(await staticPage.locator('link[hreflang="' + locale + '"]').getAttribute("href"), canonical);
      assert.ok((await (await staticPage.request.get(url + "sitemap.xml")).text()).includes("<loc>" + canonical + "</loc>"));
    }
    await staticPage.goto(url);
  }
  await info.click();
  assert.match(await staticPage.title(), /sinónimos em português europeu/i);
  assert.equal(await staticPage.locator("html").getAttribute("lang"), "pt-PT");
  if (process.env.SITE_URL) {
    const canonical = await staticPage
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    const sitemap = await (
      await staticPage.request.get(url + "sitemap.xml")
    ).text();
    assert.ok(canonical.endsWith("/editions/pt-PT/"));
    assert.ok(sitemap.includes("<loc>" + canonical + "</loc>"));
  }
  await staticPage.getByText("Revelar o sinónimo").click();
  assert.ok(await staticPage.locator("aside strong").isVisible());
  const localPlay = await staticPage
    .getByRole("link", { name: "Jogar em português", exact: true })
    .getAttribute("href");
  assert.equal(new URL(localPlay, staticPage.url()).href, url + "jogar/");
  const dailyLink = await staticPage.getByRole("link", { name: "Palavras do dia" }).getAttribute("href");
  const daily = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await daily.clock.install({ time: new Date("2026-11-19T12:00:00Z") });
  await daily.goto(new URL(dailyLink, staticPage.url()).href);
  assert.equal(await daily.locator(".question h1").innerText(), "reparar");
  assert.equal(await daily.locator(".question i").innerText(), "reparar uma fivela partida");
  const dailyButton = daily.getByRole("button", { name: "Palavras do dia", exact: true });
  await daily.getByRole("button", { name: "Início", exact: true }).click();
  assert.equal(await dailyButton.getAttribute("data-status"), "dailyUnplayed");
  await dailyButton.click();
  for (let i = 0; i < 4; i++) {
    const difficulty = ["Inicial", "Fácil", "Médio", "Difícil"][i];
    assert.equal(await daily.locator(".word-heading .difficulty").innerText(), difficulty);
    assert.equal(await daily.locator(".eyebrow").innerText(), "Palavras do dia");
    await daily.getByRole("button", { name: "Não sei" }).click();
    if (i === 0) {
      await daily.reload();
      await daily.getByRole("button", { name: "Início", exact: true }).click();
      assert.equal(await dailyButton.getAttribute("data-status"), "dailyStarted");
      await dailyButton.click();
    }
    assert.equal(await daily.locator(".feedback .difficulty").innerText(), difficulty);
    await daily.getByRole("button", { name: i === 3 ? "Ver resultado" : "Próxima palavra" }).click();
  }
  assert.match(await daily.locator(".score").innerText(), /0\s*\/\s*4/);
  await daily.getByRole("button", { name: "Voltar ao início" }).click();
  assert.equal(await dailyButton.getAttribute("data-status"), "dailyCompleted");
  assert.ok(await dailyButton.locator(".calendar-check").isVisible());
  await dailyButton.click();
  assert.match(await daily.locator(".score").innerText(), /0\s*\/\s*4/);
  await daily.getByRole("button", { name: "Voltar ao início" }).click();
  await daily.clock.fastForward("24:00:00");
  await daily.waitForSelector('.daily[data-status="dailyUnplayed"]');
  assert.equal(await daily.locator(".streak").innerText(), "1 dia seguido · Recorde: 1 dia");
  await daily.goto(url + "jogar/en-GB/");
  assert.match(await daily.locator(".streak").innerText(), /1 day in a row/);
  await daily.clock.fastForward("24:00:00");
  assert.equal(await daily.locator(".streak").innerText(), "Best: 1 day");
  const play = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await play.goto(url);
  await play
    .getByRole("link", { name: "Português europeu", exact: true })
    .click();
  await play.getByRole("button", { name: "Jogar", exact: true }).click();
  assert.equal(await play.locator(".choice").count(), 4);
  await play.getByRole("button", { name: "Início", exact: true }).click();
  const originalSave = await play.evaluate(() => localStorage.getItem("matiz.pt-PT.v1"));
  await play.getByRole("combobox").selectOption({ label: "British English" });
  await play.waitForURL(url + "jogar/en-GB/");
  await play.getByRole("button", { name: "Daily words", exact: true }).click();
  for (const [i, label] of ["Entry", "Easy", "Medium", "Hard"].entries()) {
    assert.equal(await play.locator(".difficulty").innerText(), label);
    await play.getByRole("button", { name: "I don't know" }).click();
    if (i === 0) await play.reload();
    await play.getByRole("button", { name: i === 3 ? "View result" : "Next word" }).click();
  }
  assert.match(await play.locator(".score").innerText(), /0\s*\/\s*4/);
  await play.getByRole("button", { name: "Back home" }).click();
  assert.equal(await play.locator(".daily").getAttribute("data-status"), "dailyCompleted");
  await play.getByRole("combobox").selectOption({ label: "Português europeu" });
  await play.waitForURL(url + "jogar/");
  assert.equal(await play.evaluate(() => localStorage.getItem("matiz.pt-PT.v1")), originalSave);
  await staticPage.goto(url);
  await staticPage.getByRole("link", { name: "About British English" }).click();
  assert.equal(await staticPage.locator("html").getAttribute("lang"), "en-GB");
  assert.match(await staticPage.getByRole("link", { name: "Daily words" }).getAttribute("href"), /daily\/en-GB\/$/);
  console.log(
    "Crawlable mobile homepage, project path, share card and first question passed.",
  );
} finally {
  await browser?.close();
  server.close();
}
