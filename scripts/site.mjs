import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  cp,
  mkdtemp,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { dailyBandsFor } from "../src/bands.js";
import { defaultLocale, projectRoot, readLanguages } from "./content.mjs";
import { escapeHTML as esc } from "../src/html.js";

const at = (...parts) => path.join(projectRoot, ...parts);
const read = (...parts) => readFile(at(...parts), "utf8");
const configured = process.env.SITE_URL?.replace(/\/+$/, "");
const base = configured ? new URL(configured + "/") : null;
if (
  base &&
  (!["http:", "https:"].includes(base.protocol) ||
    base.search ||
    base.hash ||
    base.username ||
    base.password)
) {
  throw Error(
    "SITE_URL must be the absolute website root, including any project path.",
  );
}
const absolute = (relative) => esc(new URL(relative, base).href);
const languages = await readLanguages();
const editionPath = locale => "editions/" + locale + "/";
function publicLinks(route) {
  if (!base) return "";
  const url = absolute(route);
  return [
    '<link rel="canonical" href="' + url + '">',
    ...languages.map(({ pack }) => '<link rel="alternate" hreflang="' + esc(pack.locale) +
      '" href="' + absolute(editionPath(pack.locale)) + '">'),
    '<link rel="alternate" hreflang="x-default" href="' + absolute("") + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:image" content="' + absolute("matiz.png") + '">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join("\n  ");
}

const editions = [];
const output = await mkdtemp(at(".matiz-site-"));
try {
  const template = await read("site", "edition.html");
  for (const { pack, locale: copy } of languages) {
    const locale = pack.locale;
    const isDefault = locale === defaultLocale;
    const relative = isDefault ? "" : locale;
    const route = isDefault ? "jogar/" : "jogar/" + locale + "/";
    const name = copy.languageName;
    let game = await read("dist", relative, "index.html");
    if (base)
      game = game.replace(
        "</head>",
        () => '<link rel="canonical" href="' + absolute(route) + '"></head>',
      );
    const dest = path.join(output, route);
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "index.html"), game);
    const info = editionPath(locale);
    const word = (
      pack.levels.find((level) => level.id === "1") ?? pack.levels[0]
    ).words[0];
    const fields = {
      ...copy.strings,
      ...copy,
      route,
      word: word.word,
      answer: word.answer,
      sentence: word.example,
    };
    const page = template
      .replace("<!-- daily-link -->", () => dailyBandsFor(pack.levels).length ? '<a href="../../' + esc(route) + '?mode=daily">' + esc(copy.strings.daily) + '</a>' : '')
      .replace("<!-- public-links -->", () => publicLinks(info))
      .replace(/\{\{(\w+)\}\}/g, (_, key) => esc(fields[key]));
    const dir = path.join(output, info);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), page);
    editions.push({ locale, route, info, name, word });
  }
  const links = editions
    .map(
      ({ locale, route, info, name }) =>
        '<p><a class="play" lang="' +
        esc(locale) +
        '" hreflang="' +
        esc(locale) +
        '" href="./' +
        esc(route) +
        '">' +
        esc(name) +
        ' <span aria-hidden="true">→</span></a>' +
        '<a hreflang="' +
        esc(locale) +
        '" href="./' +
        esc(info) +
        '" aria-label="About ' +
        esc(name) +
        '">About this edition</a></p>',
    )
    .join("\n");
  const featured = editions.find((edition) => edition.locale.startsWith("en-")) ?? editions[0];
  const example = { locale: featured.locale, name: featured.name, word: featured.word.word, answer: featured.word.answer, sentence: featured.word.example };
  let html = (await read("site", "index.html"))
    .replace(/\{\{(\w+)\}\}/g, (_, key) => esc(example[key]))
    .replace("<!-- languages -->", () => links)
    .replace("<!-- public-links -->", () => publicLinks(""));
  if (process.env.GOOGLE_SITE_VERIFICATION) {
    html = html.replace(
      "</head>",
      () =>
        '<meta name="google-site-verification" content="' +
        esc(process.env.GOOGLE_SITE_VERIFICATION) +
        '"></head>',
    );
  }
  await writeFile(path.join(output, "index.html"), html);
  await cp(at("archives", "survival"), path.join(output, "challenges"), { recursive: true });
  for (const file of ["site.css", "matiz.png"])
    await copyFile(at("site", file), path.join(output, file));
  for (const file of ["dm-sans.woff2", "dmsans-OFL.txt"])
    await copyFile(at("vendor", "fonts", file), path.join(output, file));
  if (base) {
    const urls = ["", ...editions.flatMap((e) => [e.info, e.route])].map(
      (route) => "<url><loc>" + absolute(route) + "</loc></url>",
    );
    await writeFile(
      path.join(output, "sitemap.xml"),
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        urls.join("") +
        "</urlset>\n",
    );
  }
  await rm(at("site-dist"), { force: true, recursive: true });
  await rename(output, at("site-dist"));
} catch (error) {
  await rm(output, { force: true, recursive: true });
  throw error;
}
