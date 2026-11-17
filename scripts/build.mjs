import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const [script, style, template] = await Promise.all([
  build({
    entryPoints: ["src/ui.js"],
    bundle: true,
    write: false,
    minify: true,
    target: "es2020",
    format: "iife",
  }),
  build({
    entryPoints: ["src/style.css"],
    bundle: true,
    write: false,
    minify: true,
    loader: { ".woff2": "dataurl" },
  }),
  readFile("src/index.html", "utf8"),
]);
const notices = await Promise.all(
  [
    ["Matiz · MIT", "LICENSE"],
    ["OpenQuiz · MIT", "vendor/openquiz/LICENSE"],
    ["DM Sans · SIL OFL", "vendor/fonts/dmsans-OFL.txt"],
    ["Instrument Serif · SIL OFL", "vendor/fonts/instrumentserif-OFL.txt"],
  ].map(async ([title, file]) => {
    const content = await readFile(file, "utf8");
    const escaped = content.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    return `<details><summary>${title}</summary><pre lang="en">${escaped}</pre></details>`;
  }),
);
const html = template
  .replace("/* GAME_CSS */", () => style.outputFiles[0].text)
  .replace("/* GAME_JS */", () =>
    script.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
  )
  .replace("<!-- LICENSES -->", () => notices.join("\n"));
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", html);
