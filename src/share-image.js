import qrcode from "qrcode-generator";
import { roundScore, wordsById } from "./game.js";
import { locale } from "./pack.js";
import { translate as t } from "./i18n.js";
import { dailyShareText, survivalShareText } from "./share.js";

/** Prepare before the tap: file sharing requires a live user gesture. */
export async function resultImage(session, { survival = false, best = 0, playUrl }) {
  const text = (survival ? survivalShareText : dailyShareText)(session, playUrl);
  const url = text.split("\n").at(-1);
  await Promise.all([
    document.fonts.load('600 32px "DM Sans"'),
    document.fonts.load('400 62px "Instrument Serif"'),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  const ink = "#174f42", muted = "#526a5d", paper = "#f7f5ed";
  const box = (x, y, w, h, colour, radius = 0) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  };
  const label = (value, x, y, size = 32, { colour = ink, font = "DM Sans", weight = 500, width = 936 } = {}) => {
    ctx.fillStyle = colour;
    ctx.font = `${weight} ${size}px "${font}"`;
    ctx.fillText(String(value), x, y, width);
  };
  box(0, 0, 1080, 1080, paper);
  [30, 44, 58].forEach((h, i) => box(72 + i * 19, 122 - h, 12, h, i === 2 ? "#c97735" : ink));
  label("Matiz", 142, 123, 62, { font: "Instrument Serif", weight: 400 });
  ctx.textAlign = "right";
  label(locale.locale, 1008, 113, 28, { colour: muted });
  ctx.textAlign = "left";
  box(72, 158, 936, 2, "#d7dfd2");
  label(t(survival ? "survival" : "daily"), 72, 282, 60, { weight: 600 });
  if (!survival) label(new Intl.DateTimeFormat(locale.locale, {
    day: "numeric", month: "short", timeZone: "UTC",
  }).format(session.day * 86_400_000), 76, 340, 30, { colour: muted });
  const score = roundScore(session);
  label(survival ? score : `${score} / ${session.cards.length}`, 65, 600, 240, { weight: 600 });
  if (survival) {
    box(72, 690, 280, 138, "#edf0e6", 20);
    label(t("yourBest"), 96, 739, 28, { colour: muted, width: 232 });
    label(Math.max(best, score), 96, 800, 48, { weight: 600 });
    if (session.target != null) {
      box(376, 690, 280, 138, "#edf0e6", 20);
      label(t("challenger"), 400, 739, 28, { colour: muted, width: 232 });
      label(session.target, 400, 800, 48, { weight: 600 });
    }
  } else {
    session.cards.forEach((card, index) => {
      const correct = session.answers[index] === (card.key ?? wordsById.get(card.id)?.key);
      const x = 76 + index * 76;
      box(x, 690, 58, 58, correct ? ink : "#dce2d7", 12);
      // A shape as well as colour distinguishes correct answers.
      label(correct ? "✓" : "–", x + 14, 731, 36, { colour: correct ? paper : muted });
    });
  }
  const qr = qrcode(0, "M");
  qr.addData(url, "Byte");
  qr.make();
  const count = qr.getModuleCount(), cell = Math.floor(252 / (count + 8));
  const size = (count + 8) * cell, left = 1008 - size, top = 1008 - size;
  box(left, top, size, size, "#fff");
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) box(left + (col + 4) * cell, top + (row + 4) * cell, cell, cell, ink);
    }
  }
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    value => value ? resolve(value) : reject(new Error("Could not draw result")), "image/png",
  ));
  const name = `matiz-${survival ? "survival" : "daily"}-${locale.locale}.png`;
  // The card contains the result; the caption only needs the clickable link.
  return { text: url, url, dataUrl, file: new File([blob], name, { type: "image/png" }) };
}
