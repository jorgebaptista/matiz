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
} from "./game.js";

const root = document.querySelector("#game");
const storageKey = "matiz.pt-PT.v1";
const wordTotal = levels.reduce((sum, level) => sum + level.words.length, 0);
const alert = document.querySelector("#storage-alert");
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return restoreState(saved);
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
const esc = (x) =>
  String(x).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const badge =
  '<span class="mark" aria-hidden="true"><i></i><i></i><i></i></span>';
const header = () =>
  '<header><span class="brand">' +
  badge +
  'Matiz</span><span class="locale">Português europeu</span></header>';
const bandName = (level) =>
  level.id === "0" ? "Entrada" : "Nível " + level.id;
const bandById = new Map(levels.map((level) => [level.id, level]));
function wordStatus(word) {
  if (learned(state, word)) return "Aprendida";
  return state.progress[word.id]?.seen ? "Em aprendizagem" : "Por descobrir";
}
function reviewTime(word) {
  const due = state.progress[word.id]?.dueAt;
  if (!Number.isFinite(due)) return "";
  if (due <= Date.now())
    return '<p class="review-time">Revisão disponível.</p>';
  const when = new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(due);
  return (
    '<p class="review-time">Próxima revisão · ' +
    esc(when) +
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
  const total = levels.reduce(
    (sum, l) => sum + l.words.filter((w) => learned(state, w)).length,
    0,
  );
  return (
    header() +
    '<section class="hero"><div class="art" aria-hidden="true"><i>ã</i><i>á</i><i>a</i></div>' +
    "<h1>Sinónimos</h1><p>Palavras novas e revisões em rondas de até cinco.</p>" +
    action("start", state.session ? "Continuar a ronda" : "Jogar") +
    '</section><div class="section-title"><h2>As tuas palavras</h2><span>' +
    total +
    " / " +
    wordTotal +
    ' aprendidas</span></div><div class="levels">' +
    levels
      .map((level) => {
        const seen = level.words.filter(
          (w) => state.progress[w.id]?.seen,
        ).length;
        return (
          '<details class="band"><summary class="level"><span class="number">' +
          (level.id === "0" ? "E" : level.id) +
          '</span><span class="level-text"><strong>' +
          esc(level.name) +
          "</strong><small>" +
          seen +
          " de " +
          level.words.length +
          ' vistas</small></span><span class="trail" aria-hidden="true">›</span></summary><ul>' +
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
    '<div class="nav"><button class="back" data-action="home"><span aria-hidden="true">‹</span> Início</button><span>Palavra ' +
    pos +
    " de " +
    s.cards.length +
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
    bandName(level) +
    " · " +
    esc(level.name) +
    (card.practice ? " · Prática livre" : "") +
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
      ? "Certo!"
      : value === null
        ? "Fica a saber"
        : "Não foi desta";
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
      '</p><div class="example"><h2>Exemplo</h2><blockquote>' +
      esc(word.example) +
      "</blockquote></div>" +
      reviewTime(word) +
      (value && !correct
        ? '<p class="your">Escolheste «' + esc(value) + "».</p>"
        : "") +
      "</section>" +
      action(
        "next",
        s.cursor === s.cards.length - 1 ? "Ver resultado" : "Próxima palavra",
      )
    );
  }
  return (
    top +
    '<section class="question"><h1>' +
    esc(word.word) +
    "</h1><p>Qual é o sentido mais próximo?</p></section>" +
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
    '<button class="unsure" data-action="unsure">Não sei</button>'
  );
}
function summary(s) {
  return (
    header() +
    '<section class="summary"><h1>Ronda concluída</h1><div class="score">' +
    roundScore(s) +
    "<span> / " +
    s.cards.length +
    "</span></div><p>respostas certas</p></section>" +
    action("continue", "Jogar outra ronda") +
    '<button class="unsure" data-action="close">Voltar ao início</button>'
  );
}
function render(focus = false) {
  const s = state.active && state.session;
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
  if (!state.active) return false;
  state.active = false;
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
  else if (state.active && state.session) {
    const s = state.session;
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
render();
