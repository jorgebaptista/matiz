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
    "LICENSE",
    "vendor/openquiz/LICENSE",
    "vendor/fonts/dmsans-OFL.txt",
    "vendor/fonts/instrumentserif-OFL.txt",
  ].map((f) => readFile(f, "utf8")),
);
const html = template
  .replace("/* GAME_CSS */", () => style.outputFiles[0].text)
  .replace("/* GAME_JS */", () =>
    script.outputFiles[0].text.replace(/<\/script/gi, "<\\/script"),
  )
  .replace(
    "<!-- LICENSES -->",
    () =>
      '<script type="text/plain" id="licencas">' +
      notices.join("\n\n") +
      "</script>",
  );
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", html);
