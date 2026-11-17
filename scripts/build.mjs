import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { defaultLocale, projectRoot, readLanguages } from "./content.mjs";
import { escapeHTML } from "../src/html.js";

/** Build every validated pack as a self-contained HTML file using the shared engine. */
export async function buildGames({ root = projectRoot, outdir = path.join(projectRoot, "dist"), reviewedOnly = false } = {}) {
  const languages = await readLanguages({ root, reviewedOnly });
  const [style, template, licenses] = await Promise.all([
    build({
      absWorkingDir: projectRoot, entryPoints: ["src/style.css"], bundle: true,
      write: false, minify: true, loader: { ".woff2": "dataurl" },
    }),
    readFile(path.join(projectRoot, "src/index.html"), "utf8"),
    Promise.all([
      ["licenseMatiz", "LICENSE"],
      ["licenseOpenquiz", "vendor/openquiz/LICENSE"],
      ["licenseDMSans", "vendor/fonts/dmsans-OFL.txt"],
      ["licenseInstrumentSerif", "vendor/fonts/instrumentserif-OFL.txt"],
    ].map(async ([key, file]) => [key, escapeHTML(await readFile(path.join(projectRoot, file), "utf8"))])),
  ]);
  // Bundle everything before writing, so an invalid translation never partially ships.
  const outputs = await Promise.all(languages.map(async ({ pack, locale }) => {
    const script = await build({
      absWorkingDir: projectRoot, entryPoints: ["src/ui.js"], bundle: true,
      write: false, minify: true, target: "es2020", format: "iife",
      plugins: [{
        name: "language-pack",
        setup(builder) {
          builder.onLoad({ filter: /[/\\]src[/\\]pack\.js$/ }, () => ({
            contents: `export const pack = ${JSON.stringify(pack)}; export const locale = ${JSON.stringify(locale)};`,
            loader: "js",
          }));
        },
      }],
    });
    const notices = licenses.map(([key, text]) =>
      `<details><summary>${escapeHTML(locale.strings[key])}</summary><pre lang="en">${text}</pre></details>`);
    const metadata = { locale: locale.locale, title: locale.title, description: locale.description };
    const html = template
      .replace(/\{\{([a-zA-Z]+)\}\}/g, (_, key) => escapeHTML(metadata[key] ?? locale.strings[key]))
      .replace("/* GAME_CSS */", () => style.outputFiles[0].text)
      .replace("/* GAME_JS */", () => script.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"))
      .replace("<!-- LICENSES -->", () => notices.join("\n"));
    const file = path.join(outdir, ...(locale.locale === defaultLocale ? [] : [locale.locale]), "index.html");
    return { locale: locale.locale, file, html };
  }));
  for (const { file, html } of outputs) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html);
  }
  return outputs.map(({ locale, file }) => ({ locale, file }));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await buildGames({ reviewedOnly: process.argv.includes("--reviewed") });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
