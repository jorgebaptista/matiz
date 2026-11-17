import {
  levels,
  fresh,
  learned,
  wordsById,
  restoreState,
  start,
  answer,
  next,
  finish,
  roundScore,
  hasDaily, startDaily, activeSession, practiceLevels,
} from "./game.js";
import { locale } from "./pack.js";
import { dailyDay } from "./daily.js";
import { translate, storageKey } from "./i18n.js";
import { escapeHTML as esc } from "./html.js";

const t = (key, values) => esc(translate(key, values));

const root = document.querySelector("#game");
const alert = document.querySelector("#storage-alert");
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const restored = restoreState(saved);
    if (restored.dailyActive && restored.daily.day !== dailyDay()) restored.dailyActive = false;
    return restored;
  } catch {
    return fresh();
  }
}
let state = restore();
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    alert.hidden = false;
  }
}
const badge =
  '<span class="mark" aria-hidden="true"><i></i><i></i><i></i></span>';
const header = () =>
  '<header><span class="brand">' +
  badge +
  t("brand") + '</span><span class="locale">' + esc(locale.languageName) + '</span></header>';
const bandName = (level) =>
  level.id === "0" ? t("entryBand") : t("level", { id: level.id });
const bandById = new Map(levels.map((level) => [level.id, level]));
function wordStatus(word) {
  if (learned(state, word)) return t("learned");
  return t(state.progress[word.id]?.seen ? "learning" : "unseen");
}
function reviewTime(word) {
  const progress = state.progress[word.id];
  const due = progress?.dueAt;
  if (!Number.isFinite(due)) return "";
  if (due <= Date.now() || progress.questionsLeft === 0)
    return '<p class="review-time">' + t("reviewAvailable") + '</p>';
  const when = new Intl.DateTimeFormat(locale.locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(due);
  return (
    '<p class="review-time">' +
    t("nextReview", { when }) + (progress.questionsLeft > 0
      ? t("reviewAfter", { count: progress.questionsLeft })
      : "") +
    "</p>"
  );
}
function action(id, label) {
  return (
    '<button class="primary" data-action="' +
    id +
    '">' +
    esc(label) +
    '<span aria-hidden="true">→</span></button>'
  );
}
function home() {
  const available = practiceLevels();
  const wordTotal = available.reduce((sum, level) => sum + level.words.length, 0);
  const total = available.reduce(
    (sum, l) => sum + l.words.filter((w) => learned(state, w)).length,
    0,
  );
  return (
    header() +
    '<section class="hero"><div class="art" aria-hidden="true">' +
    [...locale.strings.heroArt].map((letter) => '<i>' + esc(letter) + '</i>').join('') + '</div>' +
    '<h1>' + t("heroTitle") + '</h1><p>' + esc(locale.description) + '</p>' +
    action("start", translate(state.session ? "resume" : "play")) +
    '</section>' + (hasDaily ? '<button class="daily" data-action="daily"><strong>' + t("daily") +
      '</strong><small>' + t("dailyHint") + '</small><span aria-hidden="true">→</span></button>' : '') +
    '<div class="section-title"><h2>' + t("yourWords") + '</h2><span>' +
    t("learnedTotal", { count: total, total: wordTotal }) +
    '</span></div><div class="levels">' +
    available
      .map((level) => {
        const seen = level.words.filter(
          (w) => state.progress[w.id]?.seen,
        ).length;
        return (
          '<details class="band"><summary class="level"><span class="number">' +
          (level.id === "0" ? t("entryBadge") : esc(level.id)) +
          '</span><span class="level-text"><strong>' +
          esc(level.name) +
          "</strong><small>" +
          t("seenTotal", { count: seen, total: level.words.length }) +
          '</small></span><span class="trail" aria-hidden="true">›</span></summary><ul>' +
          level.words
            .map(
              (w) =>
                "<li><span>" +
                esc(w.word) +
                (state.progress[w.id]?.seen ? "<small class=\"synonym\">" + esc(w.key) + "</small>" : "") +
                "</span><small>" +
                wordStatus(w) +
                "</small></li>",
            )
            .join("") +
          "</ul></details>"
        );
      })
      .join("") +
    "</div>"
  );
}
function roundTop(level, s, card) {
  const pos = Math.min(s.cursor + 1, s.cards.length);
  return (
    '<div class="nav"><button class="back" data-action="home"><span aria-hidden="true">‹</span> ' + t("home") + '</button><span>' +
    t("wordPosition", { count: pos, total: s.cards.length }) +
    '</span></div><div class="steps" aria-hidden="true">' +
    s.cards
      .map(
        (_, i) =>
          '<i class="' +
          (i < s.cursor ? "done" : i === s.cursor ? "here" : "") +
          '"></i>',
      )
      .join("") +
    "</div>" +
    '<div class="eyebrow">' +
    (state.dailyActive ? dailyLabel(s) + " · " : "") + bandName(level) +
    " · " +
    esc(level.name) +
    (card.practice ? " · " + t("practice") : "") +
    "</div>"
  );
}
function play(s) {
  if (s.cursor >= s.cards.length) return summary(s);
  const card = s.cards[s.cursor],
    word = wordsById.get(card.id);
  const answered = s.answers.length > s.cursor,
    value = s.answers[s.cursor],
    correct = value === (card.key ?? word.key);
  const top = roundTop(bandById.get(word.levelId), s, card);
  if (answered) {
    const status = correct
      ? t("correct")
      : value === null
        ? t("skipped")
        : t("incorrect");
    return (
      top +
      '<section class="feedback"><div class="result ' +
      (correct ? "good" : "learn") +
      '">' +
      status +
      "</div><h1>" +
      esc(word.word) +
      '</h1><p class="meaning">' +
      esc(card.key ?? word.key) +
      '</p><div class="example"><h2>' + t("example") + '</h2><blockquote>' +
      esc(word.example) +
      "</blockquote></div>" +
      (state.dailyActive ? "" : reviewTime(word)) +
      (value && !correct
        ? '<p class="your">' + t("yourAnswer", { answer: value }) + '</p>'
        : "") +
      "</section>" +
      action(
        "next",
        translate(s.cursor === s.cards.length - 1 ? "result" : "nextWord"),
      )
    );
  }
  return (
    top +
    '<section class="question"><h1>' +
    esc(word.word) +
    '</h1><p>' + t("prompt") + '</p></section>' +
    '<div class="choices">' +
    card.options
      .map(
        (opt, i) =>
          '<button class="choice" data-action="answer-' +
          i +
          '"><span aria-hidden="true">' +
          String.fromCharCode(65 + i) +
          "</span>" +
          esc(opt) +
          "</button>",
      )
      .join("") +
    "</div>" +
    '<button class="unsure" data-action="unsure">' + t("unsure") + '</button>'
  );
}
function dailyLabel(s) {
  const date = new Intl.DateTimeFormat(locale.locale, { day: "numeric", month: "short", timeZone: "UTC" });
  return t("daily") + " · " + esc(date.format(s.day * 86_400_000)) + " · " + t(s.debut ? "dailyDebut" : "dailyEncore");
}
function summary(s) {
  return (
    header() +
    '<section class="summary"><h1>' + (state.dailyActive ? dailyLabel(s) : t("roundComplete")) + '</h1><div class="score">' +
    roundScore(s) +
    "<span> / " +
    s.cards.length +
    '</span></div><p>' + t("correctAnswers") + '</p></section>' +
    (state.dailyActive ? action("home", translate("backHome")) :
    action("continue", translate("playAgain")) +
    '<button class="unsure" data-action="close">' + t("backHome") + '</button>')
  );
}
function render(focus = false) {
  const s = activeSession(state);
  root.classList.toggle("in-round", Boolean(s && s.cursor < s.cards.length));
  root.innerHTML = s ? play(s) : home();
  if (!s)
    root.append(document.querySelector("#credits").content.cloneNode(true));
  window.scrollTo(0, 0);
  if (focus) {
    const h = root.querySelector(".result") ?? root.querySelector("h1");
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}
function goHome() {
  if (!activeSession(state)) return false;
  state.active = false;
  state.dailyActive = false;
  save();
  render(true);
  return true;
}
window.matizBack = goHome;
window.addEventListener("storage", (e) => {
  if (e.key === storageKey) {
    state = restore();
    render();
  }
});
root.addEventListener("click", (e) => {
  const target = e.target.closest("button[data-action]");
  if (!target || target.disabled) return;
  const id = target.dataset.action;
  if (id === "home") {
    goHome();
    return;
  }
  if (id === "start") start(state);
  else if (id === "daily") startDaily(state);
  else if (activeSession(state)) {
    const s = activeSession(state);
    if (id.startsWith("answer-"))
      answer(state, s.cards[s.cursor].options[Number(id.slice(7))]);
    else if (id === "unsure") answer(state, null);
    else if (id === "next") next(state);
    else if (id === "continue" || id === "close") {
      finish(state);
      if (id === "continue") start(state);
    }
  }
  save();
  render(true);
});
const entry = new URL(window.location.href);
if (hasDaily && entry.searchParams.get("mode") === "daily") {
  startDaily(state);
  save();
  entry.searchParams.delete("mode");
  if (entry.protocol === "http:" || entry.protocol === "https:")
    history.replaceState(null, "", entry.href);
}
render();
