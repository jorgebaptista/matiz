import { roundScore, wordsById } from "./game.js";
import { locale } from "./pack.js";
import { translate } from "./i18n.js";

/** Describe a completed daily using its saved answers, without revealing words. */
export function dailyShareText(session, playUrl) {
  if (!session.cards.length || session.answers.length !== session.cards.length)
    throw new Error("Finish the daily before sharing it.");
  const date = new Intl.DateTimeFormat(locale.locale, {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(session.day * 86_400_000);
  const squares = session.cards.map((card, index) =>
    session.answers[index] === (card.key ?? wordsById.get(card.id)?.key) ? "🟩" : "⬜",
  ).join("");
  const link = new URL(playUrl);
  link.search = "?mode=daily";
  link.hash = "";
  return [
    `Matiz · ${translate("daily")} · ${locale.locale}`,
    date,
    `${squares} ${roundScore(session)}/${session.cards.length}`,
    link.href,
  ].join("\n");
}

/** Share a reproducible Survival invitation with a score and no answer text. */
export function survivalShareText(session, playUrl) {
  if (session.cursor !== session.cards.length) throw new Error("Finish the run before sharing it.");
  const link = new URL(playUrl);
  link.search = new URLSearchParams({
    mode: "survival", seed: String(session.seed), v: session.version, score: String(roundScore(session)),
  }).toString();
  link.hash = "";
  return [
    `Matiz · ${translate("survival")} · ${locale.locale}`,
    translate("survivalShareScore", { count: roundScore(session) }),
    translate("survivalShareInvite"),
    link.href,
  ].join("\n");
}
