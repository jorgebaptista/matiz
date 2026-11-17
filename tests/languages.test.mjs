import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, rm, access, rename } from "node:fs/promises";
import path from "node:path";
import { checkLocale, readLanguages, readContent, projectRoot } from "../scripts/content.mjs";
import { buildGames } from "../scripts/build.mjs";
import { translate, storageKey } from "../src/i18n.js";
import { fixturePack, fixtureLocale, languageFixture } from "./language-fixture.mjs";

test("locale metadata, exact UI keys and every placeholder occurrence are required", () => {
  checkLocale(fixturePack, fixtureLocale);
  const reject = (change, pattern) => {
    const locale = structuredClone(fixtureLocale);
    change(locale);
    assert.throws(() => checkLocale(fixturePack, locale), pattern);
  };
  reject((locale) => { locale.locale = "en-US"; }, /metadata/);
  reject((locale) => { locale.title = " "; }, /title/);
  reject((locale) => { delete locale.languageName; }, /languageName/);
  reject((locale) => { delete locale.strings.prompt; }, /UI keys/);
  reject((locale) => { locale.strings.typo = "Unexpected"; }, /UI keys/);
  reject((locale) => { locale.strings.credits = ""; }, /empty translation/);
  for (const template of ["{count} of {missing}", "{count} {count} {total}", "{count} {total} {bad-key}"])
    reject((locale) => { locale.strings.seenTotal = template; }, /placeholder/);
  reject((locale) => { delete locale.strings.reviewAfter.one; }, /plural forms/);
  reject((locale) => { locale.strings.reviewAfter.other = "after {total}"; }, /placeholder/);
  reject((locale) => { locale.strings.reviewAfter.few = ""; }, /empty translation/);
  assert.throws(() => checkLocale(fixturePack, fixtureLocale, "en-gb"), /BCP47/);
});

test("PT-PT keeps its key, templates and singular/plural wording", () => {
  assert.equal(storageKey, "matiz.pt-PT.v1");
  assert.equal(translate("reviewAfter", { count: 1 }), " ou após 1 outra pergunta, se for mais cedo");
  assert.equal(translate("reviewAfter", { count: 2 }), " ou após 2 outras perguntas, se for mais cedo");
  assert.equal(translate("seenTotal", { count: 2, total: 8 }), "2 de 8 vistas");
});

test("convention discovery builds two offline files, preserves legal notices and excludes drafts", async () => {
  const fixture = await languageFixture();
  try {
    const languages = await readLanguages(fixture);
    assert.deepEqual(languages.map(({ pack }) => pack.locale), ["en-GB", "pt-PT"]);
    assert.equal(languages[0].counts.draft, 1);
    const outputs = await buildGames(fixture);
    assert.deepEqual(outputs.map(({ file }) => path.relative(fixture.outdir, file)), [path.join("en-GB", "index.html"), "index.html"]);
    const english = await readFile(path.join(fixture.outdir, "en-GB/index.html"), "utf8");
    const portuguese = await readFile(path.join(fixture.outdir, "index.html"), "utf8");
    assert.match(english, /<html lang="en-GB">/);
    assert.match(english, /<title>Matiz · Synonyms<\/title>/);
    assert.match(english, /Which meaning is closest/);
    assert.doesNotMatch(english, /draft-only|Qual é o sentido|renitente/);
    assert.ok(portuguese.includes(`<title>${languages[1].locale.title}</title>`));
    assert.doesNotMatch(english, /<(?:script|link)[^>]+(?:src|href)=/);
    assert.doesNotMatch(english, /url\((?!data:)/);
    const expected = await readContent("locales");
    for (const key of ["licenseMatiz", "licenseOpenquiz", "licenseDMSans", "licenseInstrumentSerif"])
      assert.ok(portuguese.includes(`<summary>${expected.strings[key]}</summary>`));
    const notices = (html) => [...html.matchAll(/<pre lang="en">([\s\S]*?)<\/pre>/g)].map((match) => match[1]);
    assert.equal(notices(english).length, 4);
    assert.deepEqual(notices(english), notices(portuguese));
    const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
    const files = ["LICENSE", "vendor/openquiz/LICENSE", "vendor/fonts/dmsans-OFL.txt", "vendor/fonts/instrumentserif-OFL.txt"];
    assert.deepEqual(notices(portuguese), await Promise.all(files.map(async (file) => escape(await readFile(path.join(projectRoot, file), "utf8")))));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("unpaired files, invalid drafts and invalid translations fail before any build output", async () => {
  const fixture = await languageFixture();
  try {
    const file = path.join(fixture.root, "locales/en-GB.json");
    await rename(file, file + ".hold");
    await assert.rejects(buildGames(fixture), /matching/);
    await assert.rejects(access(fixture.outdir), /ENOENT/);
    await rename(file + ".hold", file);
    const locale = structuredClone(fixtureLocale);
    delete locale.strings.prompt;
    await writeFile(file, JSON.stringify(locale));
    await assert.rejects(buildGames(fixture), /UI keys/);
    await assert.rejects(access(fixture.outdir), /ENOENT/);
    await writeFile(file, JSON.stringify(fixtureLocale));
    await writeFile(path.join(fixture.root, "editorial/en-GB.json"), JSON.stringify({ locale: "en-US", words: [] }));
    await assert.rejects(buildGames(fixture), /Draft locale/);
    await rm(path.join(fixture.root, "editorial"), { recursive: true });
    assert.equal((await readLanguages(fixture)).length, 2); // Draft files are optional.
    await assert.rejects(buildGames({ ...fixture, reviewedOnly: true }), /pilot questions/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
