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
const theme = await read("src", "theme.js");
const themeButton = await read("src", "theme-button.html");
const editionPath = locale => "editions/" + locale + "/";
const dailyPath = locale => "daily/" + locale + "/";
const gamePath = locale => locale === defaultLocale ? "jogar/" : "jogar/" + locale + "/";
const dailyLanguages = languages.filter(({ pack }) => dailyBandsFor(pack.levels).length);
function publicLinks(route, variant = editionPath, variants = languages) {
  if (!base) return "";
  const url = absolute(route);
  return [
    '<link rel="canonical" href="' + url + '">',
    ...variants.map(({ pack }) => '<link rel="alternate" hreflang="' + esc(pack.locale) +
      '" href="' + absolute(variant(pack.locale)) + '">'),
    ...(variant === editionPath ? ['<link rel="alternate" hreflang="x-default" href="' + absolute("") + '">'] : []),
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
    const route = gamePath(locale);
    const name = copy.languageName;
    const game = await read("dist", relative, "index.html");
    const daily = dailyLanguages.some(language => language.pack.locale === locale) ? dailyPath(locale) : null;
    async function writeGamePage(destination, source, title, description, headLinks) {
      const meta = '<meta property="og:type" content="website"><meta property="og:title" content="' + esc(title) +
        '"><meta property="og:description" content="' + esc(description) + '">';
      const dir = path.join(output, destination);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "index.html"), source.replace("</head>", () => meta + headLinks + "</head>"));
    }
    await writeGamePage(route, game, copy.title, copy.description, publicLinks(route, gamePath));
    if (daily) {
      const { dailyTitle, dailyDescription } = copy.strings;
      const title = dailyTitle + " · Matiz";
      const otherEditions = dailyLanguages.filter(language => language.pack.locale !== locale)
        .map(({ pack, locale }) => {
          const href = path.posix.relative(route, dailyPath(pack.locale)) + "/";
          return '<a lang="' + esc(pack.locale) + '" href="' + esc(href) + '">' + esc(locale.languageName) + '</a>';
        });
      const source = game
        .replace("<head>", () => '<head><base href="../../' + esc(route) + '">')
        .replace("<title>" + esc(copy.title) + "</title>", () => "<title>" + esc(title) + "</title>")
        .replace('name="description" content="' + esc(copy.description) + '"', () => 'name="description" content="' + esc(dailyDescription) + '"')
        .replace('<main id="game"></main>', () => '<main id="game" data-mode="daily"></main><footer class="daily-info"><h2>' +
          esc(dailyTitle) + '</h2><p>' + esc(dailyDescription) + '</p>' + otherEditions.join(' · ') + '</footer>');
      await writeGamePage(daily, source, title, dailyDescription, publicLinks(daily, dailyPath, dailyLanguages));
    }
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
      .replace("<!-- theme-button -->", () => themeButton)
      .replace("/* THEME_JS */", () => theme)
      .replace("<!-- daily-link -->", () => daily ? '<a href="../../' + esc(daily) + '">' + esc(copy.strings.daily) + '</a>' : '')
      .replace("<!-- public-links -->", () => publicLinks(info))
      .replace(/\{\{(\w+)\}\}/g, (_, key) => esc(fields[key]));
    const dir = path.join(output, info);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), page);
    editions.push({ locale, route, info, daily, name, word });
  }
  const links = editions
    .map(
      ({ locale, route, info, daily, name }) =>
        '<p><a class="play" lang="' +
        esc(locale) +
        '" hreflang="' +
        esc(locale) +
        '" href="./' +
        esc(route) +
        '">' +
        esc(name) +
        ' <span aria-hidden="true">→</span></a>' +
        (daily ? '<a hreflang="' + esc(locale) + '" href="./' + esc(daily) + '" aria-label="Play today’s four words in ' + esc(name) + '">Daily quiz</a>' : '') +
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
    .replace("<!-- theme-button -->", () => themeButton.replaceAll("{{darkMode}}", "Dark mode"))
    .replace("/* THEME_JS */", () => theme)
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
  await writeFile(path.join(output, "site.css"), (await read("src", "theme.css")) + "\n" + (await read("site", "site.css")));
  for (const file of ["matiz.png"])
    await copyFile(at("site", file), path.join(output, file));
  for (const file of ["dm-sans.woff2", "dmsans-OFL.txt"])
    await copyFile(at("vendor", "fonts", file), path.join(output, file));
  if (base) {
    const urls = ["", ...editions.flatMap((e) => [e.info, e.route, e.daily].filter(Boolean))].map(
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
