import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";

/** Decode the attachment and check that it accompanies a playable link. */
export async function checkSharedImage(page, name) {
  const data = await page.evaluate(async () => {
    const shared = window.shared.at(-1), file = shared.files[0];
    const buffer = new Uint8Array(await file.arrayBuffer());
    return { bytes: Array.from(buffer), name: file.name, type: file.type, text: shared.text };
  });
  assert.equal(data.type, "image/png");
  assert.match(data.name, /^matiz-.*\.png$/);
  const png = PNG.sync.read(Buffer.from(data.bytes));
  assert.deepEqual([png.width, png.height], [1080, 640]);
  assert.equal(new URL(data.text).protocol, "https:");
  if (process.env.MATIZ_SCREENSHOTS) {
    await mkdir(process.env.MATIZ_SCREENSHOTS, { recursive: true });
    await writeFile(path.join(process.env.MATIZ_SCREENSHOTS, name + ".png"), Buffer.from(data.bytes));
  }
  return data.text;
}
