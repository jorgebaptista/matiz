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
  hasDaily, startDaily, activeSession, practiceLevels, startSurvival, reconcileSurvival,
} from "./game.js";
import { locale, survivalArchives } from "./pack.js";
import { dailyDay } from "./daily.js";
import { translate, storageKey } from "./i18n.js";
import { escapeHTML as esc } from "./html.js";
import { resultImage } from "./share-image.js";
import { readChallenge, survivalVersion, survivalId } from "./survival.js";

const t = (key, values) => esc(translate(key, values));

const root = document.querySelector("#game");
const alert = document.querySelector("#storage-alert");
const bundledApp = location.protocol === "file:" && location.pathname.startsWith("/android_asset/");
const editionPicker = document.querySelector("#edition-picker").content.querySelector("select");
const canSwitch = (bundledApp || /^https?:$/.test(location.protocol)) && editionPicker.options.length > 1;
function themeControl() {
  const button = document.querySelector("#theme-control").content.firstElementChild.cloneNode(true);
  button.setAttribute("aria-pressed", String(document.documentElement.dataset.theme === "dark"));
  return button.outerHTML;
}
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
let invitation = null;
let shareCard = null;
let renderVersion = 0;
function save() {
  try {
    if (state.survivalAttempts) {
      let previous;
      try { previous = JSON.parse(localStorage.getItem(storageKey)); }
      catch { previous = null; }
      reconcileSurvival(state, previous);
    }
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
  t("brand") + '</span><div class="header-tools">' + (canSwitch ? editionPicker.outerHTML :
    '<span class="locale">' + esc(locale.languageName) + '</span>') + themeControl() + '</div></header>';
const bandById = new Map(levels.map((level) => [level.id, level]));
const difficultyKeys = ["entryBand", "easyBand", "mediumBand", "hardBand"];
function wordHeading(word) {
  const key = difficultyKeys[word.levelId];
  const label = key ? t(key) : esc(bandById.get(word.levelId).name);
  return '<div class="word-heading"><h1>' + esc(word.word) + '</h1><span class="difficulty" data-band="' +
    esc(word.levelId) + '">' + label + '</span></div>';
}
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
function action(id, label, symbol = "→") {
  return (
    '<button class="primary" data-action="' +
    id +
    '">' +
    esc(label) +
    '<span aria-hidden="true">' + symbol + '</span></button>'
  );
}
const dailyButton = () =>
  '<button class="daily" data-action="daily" aria-describedby="daily-status">' +
  '<svg class="calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7.5 3v4m9-4v4M3 10h18"/>' +
  '<circle class="calendar-dot" cx="12" cy="15.5" r="2" fill="currentColor" stroke="none"/>' +
  '<path class="calendar-check" d="m8.5 15.5 2.4 2.3 4.8-5"/></svg>' +
  '<strong>' + t("daily") + '</strong><span class="daily-arrow" aria-hidden="true">→</span></button>' +
  '<span hidden id="daily-status"></span>';

function refreshDailyButton() {
  const button = root.querySelector('[data-action="daily"]');
  if (!button) return;
  const daily = state.daily;
  let status = "dailyUnplayed";
  if (daily?.day === dailyDay() && daily.answers.length)
    status = daily.answers.length === daily.cards.length ? "dailyCompleted" : "dailyStarted";
  if (button.dataset.status === status) return;
  button.dataset.status = status;
  root.querySelector("#daily-status").textContent = translate(status);
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
    '</section>' + (hasDaily ? dailyButton() : '') +
    '<button class="survival" data-action="survival"><span class="survival-icon" aria-hidden="true">⚡</span><strong>' +
    t(state.survival && state.survival.cursor < state.survival.cards.length ? "resumeSurvival" : "survival") +
    '</strong><span class="survival-best">' + t("personalBest", { count: state.survivalBests?.[survivalVersion(levels)] ?? 0 }) + '</span></button>' +
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
function roundTop(s, card) {
  const pos = Math.min(s.cursor + 1, s.cards.length);
  const caption = state.survivalActive ? t("survival") : state.dailyActive ? t("daily") : card.practice ? t("practice") : "";
  return (
    '<div class="nav"><button class="back" data-action="home"><span aria-hidden="true">‹</span> ' + t("home") + '</button><div class="header-tools"><span class="position">' +
    (state.survivalActive ? '' : t("wordPosition", { count: pos, total: s.cards.length })) +
    '</span>' + themeControl() + '</div></div>' + (state.survivalActive ? '' : '<div class="steps" aria-hidden="true">' +
    s.cards
      .map(
        (_, i) =>
          '<i class="' +
          (i < s.cursor ? "done" : i === s.cursor ? "here" : "") +
          '"></i>',
      )
      .join("") +
    "</div>") + (caption ? '<div class="eyebrow">' + caption + "</div>" : "") +
    (state.survivalActive ? survivalStats(s) : '')
  );
}
function survivalStats(s, summary = false) {
  const stats = [["currentScore", roundScore(s)], ["yourBest", Math.max(roundScore(s), state.survivalBests?.[s.version] ?? 0)]];
  if (s.target != null) stats.push(["challenger", s.target]);
  return '<dl class="survival-stats' + (summary ? ' final-stats' : '') + '">' + stats.map(([key, value], index) =>
    '<div><dt>' + t(key) + '</dt><dd data-stat="' + key + '"' +
    (summary && index === 0 ? ' class="score"' : '') + '>' + value + '</dd></div>').join('') + '</dl>';
}
function play(s) {
  if (s.cursor >= s.cards.length) return summary(s);
  const card = s.cards[s.cursor],
    word = state.survivalActive ? card : wordsById.get(card.id);
  const answered = s.answers.length > s.cursor,
    value = s.answers[s.cursor],
    correct = value === (card.key ?? word.key);
  const top = roundTop(s, card);
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
      "</div>" + wordHeading(word) + '<p class="meaning">' +
      esc(card.key ?? word.key) +
      '</p><div class="example"><h2>' + t("example") + '</h2><blockquote>' +
      esc(word.example) +
      "</blockquote></div>" +
      (state.dailyActive || state.survivalActive ? "" : reviewTime(word)) +
      (value && !correct
        ? '<p class="your">' + t("yourAnswer", { answer: value }) + '</p>'
        : "") +
      "</section>" +
      action(
        "next",
        translate(s.cursor === s.cards.length - 1 || (state.survivalActive && !correct) ? "result" : "nextWord"),
      )
    );
  }
  return (
    top +
    '<section class="question">' + wordHeading(word) + '<p>' + t("prompt") + '</p></section>' +
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
  return t("daily") + " · " + esc(date.format(s.day * 86_400_000)) + (s.debut ? "" : " · " + t("dailyEncore"));
}
function summary(s) {
  if (state.survivalActive) return survivalSummary(s);
  return (
    header() +
    '<section class="summary"><h1>' + (state.dailyActive ? dailyLabel(s) : t("roundComplete")) + '</h1><div class="score">' +
    roundScore(s) +
    "<span> / " +
    s.cards.length +
    '</span></div><p>' + t("correctAnswers") + '</p></section>' +
    (state.dailyActive ? shareControls("shareResult") +
      '<button class="unsure" data-action="home">' + t("backHome") + '</button>' :
    action("continue", translate("playAgain")) +
    '<button class="unsure" data-action="close">' + t("backHome") + '</button>')
  );
}
function survivalSummary(s) {
  const score = roundScore(s);
  const comparison = score > s.target ? "challengeWon" : score === s.target ? "challengeTied" : "challengeLost";
  return header() + '<section class="summary"><h1>' + t(score === s.cards.length ? "survivalCleared" : "survivalOver") +
    '</h1>' + survivalStats(s, true) +
    (s.target !== null ? '<p class="challenge-target">' + t(comparison, { count: s.target }) + '</p>' : '') + '</section>' +
    shareControls("challengeFriend") +
    '<button class="secondary" data-action="new-survival">' + t("newRun") + '</button>' +
    '<button class="unsure" data-action="home">' + t("backHome") + '</button>';
}
function survivalInvitation() {
  if (invitation.error) return header() + '<section class="summary"><h1>' + t("survival") + '</h1><p>' +
    t(invitation.error) + '</p></section>' + action("home", translate("backHome"));
  const replacesRun = state.survival && state.survival.cursor < state.survival.cards.length &&
    (!invitation.run || state.survival.seed !== invitation.run.seed || state.survival.version !== invitation.run.version);
  const completed = invitation.run && state.survivalAttempts?.[survivalId(invitation.run)]?.cursor === invitation.run.cards.length;
  return header() + '<section class="summary"><h1>' + t("survival") + '</h1><p class="survival-rules">' +
    t("survivalRules") + '</p>' + (invitation.run?.target != null ? '<p class="challenge-target">' +
      t("scoreToBeat", { count: invitation.run.target }) + '</p>' : '') + '</section>' +
    action("accept-survival", translate(completed ? "result" : replacesRun ? "replaceRun" : "startSurvival")) +
    '<button class="unsure" data-action="home">' + t("backHome") + '</button>';
}
function shareControls(label) {
  return action("share", translate(label), "↗") + '<p class="share-status" role="status"></p>' +
    '<div class="share-fallback" hidden><img class="share-preview" alt="' + t("shareResult") + '">' +
    '<div class="share-actions"><a class="secondary" data-download>' + t("saveImage") + '</a>' +
    '<button class="secondary" data-action="copy-link">' + t("copyLink") + '</button></div></div>' +
    '<textarea class="share-text" hidden readonly aria-label="' + t("copyLink") + '"></textarea>';
}
function showShareFallback() {
  const fallback = root.querySelector(".share-fallback");
  if (!shareCard || !fallback) return;
  fallback.hidden = false;
  fallback.querySelector("img").src = shareCard.dataUrl;
  const download = fallback.querySelector("[data-download]");
  download.href = shareCard.dataUrl;
  download.download = shareCard.file.name;
}
// Android reads this only after a main-frame request from a bundled edition.
window.matizSharePayload = () => shareCard ? { image: shareCard.dataUrl, text: shareCard.text } : null;
window.matizShareFailed = () => {
  const status = root.querySelector(".share-status");
  if (status) status.textContent = translate("imageUnavailable");
};
async function copyShareLink() {
  if (!shareCard) return;
  const url = shareCard.url;
  const status = root.querySelector(".share-status"), field = root.querySelector(".share-text");
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = translate("linkCopied");
  } catch {
    field.value = url;
    field.hidden = false;
    field.focus();
    field.select();
  }
}
async function shareResult(button) {
  const version = renderVersion;
  const status = root.querySelector(".share-status");
  status.textContent = "";
  root.querySelector(".share-text").hidden = true;
  if (!shareCard) { render(); return; }
  if (bundledApp) {
    location.assign("matiz-share://result");
    return;
  }
  button.disabled = true;
  try {
    if (navigator.share && navigator.canShare?.({ files: [shareCard.file] })) {
      await navigator.share({ files: [shareCard.file], text: shareCard.text });
      return;
    }
    showShareFallback();
  } catch (error) {
    if (error.name !== "AbortError" && version === renderVersion) showShareFallback();
  } finally {
    button.disabled = false;
  }
}
function render(focus = false) {
  const version = ++renderVersion;
  shareCard = null;
  const s = activeSession(state);
  root.classList.toggle("in-round", Boolean(!invitation && s && s.cursor < s.cards.length));
  root.innerHTML = invitation ? survivalInvitation() : s ? play(s) : home();
  const shareButton = root.querySelector('[data-action="share"]');
  if (shareButton) {
    shareButton.disabled = true;
    resultImage(s, {
      survival: state.survivalActive,
      playUrl: document.querySelector(state.survivalActive ? 'meta[name="matiz-play-url"]' : 'meta[name="matiz-daily-url"]').content,
    }).then(card => {
      if (version === renderVersion) shareCard = card;
    }).catch(() => {
      if (version === renderVersion) root.querySelector(".share-status").textContent = translate("imageUnavailable");
    }).finally(() => { if (version === renderVersion) shareButton.disabled = false; });
  }
  if (!s && !invitation) {
    root.append(document.querySelector("#credits").content.cloneNode(true));
    refreshDailyButton();
  }
  window.scrollTo(0, 0);
  if (focus) {
    const h = root.querySelector(".result") ?? root.querySelector("h1");
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}
function goHome() {
  if (!activeSession(state) && !invitation) return false;
  invitation = null;
  clearChallengeUrl();
  state.active = false;
  state.dailyActive = false;
  state.survivalActive = false;
  save();
  if (root.dataset.mode === "daily") location.replace(document.baseURI);
  else render(true);
  return true;
}
window.matizBack = goHome;
root.addEventListener("change", event => {
  if (!canSwitch || !event.target.matches("select.locale")) return;
  location.assign(event.target.value + (bundledApp ? "index.html" : ""));
});
if (hasDaily) {
  // Refresh the indicator if the home screen stays open across Lisbon midnight.
  window.setInterval(refreshDailyButton, 30_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshDailyButton();
  });
}
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
  if (id === "copy-link") { copyShareLink(); return; }
  if (id === "share" && (state.dailyActive || state.survivalActive)) {
    shareResult(target);
    return;
  }
  if (id === "home") {
    goHome();
    return;
  }
  if (id === "survival") {
    if (state.survival) startSurvival(state);
    else invitation = {};
  } else if (id === "new-survival") {
    state.survival = null;
    startSurvival(state);
  } else if (id === "accept-survival" && invitation && !invitation.error) {
    startSurvival(state, invitation.run?.seed, invitation.run?.target ?? null, invitation.levels ?? levels);
    invitation = null;
    clearChallengeUrl();
  } else if (id === "start") start(state);
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
function clearChallengeUrl() {
  if (!["http:", "https:", "file:"].includes(entry.protocol)) return;
  for (const key of ["mode", "seed", "v", "score"]) entry.searchParams.delete(key);
  history.replaceState(null, "", entry.href);
}
if (entry.searchParams.get("mode") === "survival") {
  invitation = readChallenge(entry.searchParams, levels, survivalArchives);
} else if (hasDaily && (root.dataset.mode === "daily" || entry.searchParams.get("mode") === "daily")) {
  startDaily(state);
  save();
  entry.searchParams.delete("mode");
  if (entry.protocol === "http:" || entry.protocol === "https:")
    history.replaceState(null, "", entry.href);
}
render();
