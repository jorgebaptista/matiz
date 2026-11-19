import { roundScore, wordsById } from "./game.js";
import { flamePath } from "./streak.js";
import { locale } from "./pack.js";
import { translate as t } from "./i18n.js";
import { dailyShareText, survivalShareText } from "./share.js";

/** Prepare before the tap: file sharing requires a live user gesture. */
export async function resultImage(session, { survival = false, playUrl, streak }) {
  const text = (survival ? survivalShareText : dailyShareText)(session, playUrl);
  const url = text.split("\n").at(-1);
  await Promise.all([
    document.fonts.load('600 32px "DM Sans"'),
    document.fonts.load('400 62px "Instrument Serif"'),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  const style = getComputedStyle(document.documentElement);
  const colour = name => style.getPropertyValue(name).trim();
  const ink = colour("--green"), muted = colour("--muted"), paper = colour("--paper");
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
  [30, 44, 58].forEach((h, i) => box(72 + i * 19, 122 - h, 12, h, i === 2 ? colour("--current-step") : ink));
  label("Matiz", 142, 123, 62, { font: "Instrument Serif", weight: 400 });
  ctx.textAlign = "right";
  label(locale.locale, 1008, 113, 28, { colour: muted });
  ctx.textAlign = "left";
  box(72, 158, 936, 2, colour("--line"));
  label(t(survival ? "survival" : "daily"), 72, 250, 52, { weight: 600 });
  if (!survival) label(new Intl.DateTimeFormat(locale.locale, {
    day: "numeric", month: "short", timeZone: "UTC",
  }).format(session.day * 86_400_000), 76, 297, 28, { colour: muted });
  const score = roundScore(session);
  const scoreLabel = survival ? String(score) : `${score} / ${session.cards.length}`;
  const scoreBaseline = 487;
  label(scoreLabel, 65, scoreBaseline, 210, { weight: 600 });
  if (survival) {
    label(t("survivalShareInvite"), 76, 568, 34, { colour: muted });
  } else {
    ctx.save();
    const flameScale = 4.25;
    const bounds = ctx.measureText(scoreLabel);
    const scoreCenter = scoreBaseline + (bounds.actualBoundingBoxDescent - bounds.actualBoundingBoxAscent) / 2;
    ctx.translate(933 - 20 * flameScale, scoreCenter - 24 * flameScale);
    ctx.scale(flameScale, flameScale);
    ctx.fillStyle = colour("--orange");
    ctx.fill(new Path2D(flamePath));
    ctx.textAlign = "center";
    label(streak, 20, 36, 17, { colour: "#472209", weight: 700, width: 30 });
    ctx.restore();
    session.cards.forEach((card, index) => {
      const correct = session.answers[index] === (card.key ?? wordsById.get(card.id)?.key);
      const x = 76 + index * 76;
      box(x, 530, 58, 58, correct ? ink : colour("--track"), 12);
      // A shape as well as colour distinguishes correct answers.
      label(correct ? "✓" : "–", x + 14, 571, 36, { colour: correct ? paper : muted });
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
