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
  canvas.width = 1080;
  canvas.height = 800;
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
  box(0, 0, canvas.width, canvas.height, paper);
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
  label(survival ? score : `${score} / ${session.cards.length}`, 65, 555, 220, { weight: 600 });
  if (survival) {
    box(72, 620, 280, 118, "#edf0e6", 20);
    label(t("yourBest"), 96, 660, 28, { colour: muted, width: 232 });
    label(Math.max(best, score), 96, 714, 48, { weight: 600 });
    if (session.target != null) {
      box(376, 620, 280, 118, "#edf0e6", 20);
      label(t("challenger"), 400, 660, 28, { colour: muted, width: 232 });
      label(session.target, 400, 714, 48, { weight: 600 });
    }
  } else {
    session.cards.forEach((card, index) => {
      const correct = session.answers[index] === (card.key ?? wordsById.get(card.id)?.key);
      const x = 76 + index * 76;
      box(x, 620, 58, 58, correct ? ink : "#dce2d7", 12);
      // A shape as well as colour distinguishes correct answers.
      label(correct ? "✓" : "–", x + 14, 661, 36, { colour: correct ? paper : muted });
    });
  }
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    value => value ? resolve(value) : reject(new Error("Could not draw result")), "image/png",
  ));
  const name = `matiz-${survival ? "challenge" : "daily"}-${locale.locale}.png`;
  // The card contains the result; the caption only needs the clickable link.
  return { text: url, url, dataUrl, file: new File([blob], name, { type: "image/png" }) };
}
