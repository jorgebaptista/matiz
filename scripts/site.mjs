import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  mkdtemp,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
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
const editions = [];
const output = await mkdtemp(at(".matiz-site-"));
try {
  for (const { pack, locale: copy } of await readLanguages()) {
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
    editions.push({ locale, route, name, pack });
  }
  const pt = editions.find((e) => e.locale === defaultLocale);
  const word =
    pt.pack.levels
      .flatMap((level) => level.words)
      .find((w) => w.id === "renitente") ?? pt.pack.levels[0].words[0];
  const extra = editions.filter((e) => e !== pt);
  const links = extra
    .map(
      (e) =>
        '<a lang="' +
        esc(e.locale) +
        '" href="./' +
        esc(e.route) +
        '">' +
        esc(e.name) +
        "</a>",
    )
    .join(" ");
  const replacements = {
    "sample-word": esc(word.word),
    "sample-answer": esc(word.answer),
    "sample-example": esc(word.example),
    languages: extra.length
      ? '<section><h2>Outras línguas</h2><p class="links">' +
        links +
        "</p></section>"
      : "",
    "public-links": base
      ? '<link rel="canonical" href="' +
        absolute("") +
        '">\n  <meta property="og:url" content="' +
        absolute("") +
        '">\n  <meta property="og:image" content="' +
        absolute("matiz.png") +
        '">\n  <meta property="og:image:alt" content="Matiz, jogo de sinónimos em português europeu">\n  <meta name="twitter:card" content="summary_large_image">'
      : "",
  };
  let html = await read("site", "index.html");
  for (const [key, value] of Object.entries(replacements))
    html = html.replace("<!-- " + key + " -->", () => value);
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
  for (const file of ["site.css", "matiz.png"])
    await copyFile(at("site", file), path.join(output, file));
  for (const file of ["dm-sans.woff2", "dmsans-OFL.txt"])
    await copyFile(at("vendor", "fonts", file), path.join(output, file));
  if (base) {
    const urls = ["", ...editions.map((e) => e.route)].map(
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
