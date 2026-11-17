import {
  levels,
  fresh,
  fixedCount,
  complete,
  unlocked,
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
    return saved?.version === 1 && saved.progress && saved.sessions
      ? saved
      : fresh();
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
const current = () => levels.find((l) => l.id === state.active);
const badge =
  '<span class="mark" aria-hidden="true"><i></i><i></i><i></i></span>';
const header = () =>
  '<header><span class="brand">' +
  badge +
  'Matiz</span><span class="locale">Português europeu</span></header>';
const over = (level) =>
  '<div class="eyebrow">Nível ' +
  level.id +
  " <span>·</span> " +
  esc(level.name) +
  "</div>";
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
  const focus = levels.find((l) => !complete(state, l)) ?? levels.at(-1);
  const total = levels.reduce((n, l) => n + fixedCount(state, l), 0);
  const started =
    !!state.sessions[focus.id] || focus.words.some((w) => state.progress[w.id]);
  return (
    header() +
    '<section class="hero"><div class="art" aria-hidden="true"><i>ã</i><i>á</i><i>a</i></div>' +
    '<h1>Sinónimos</h1><p>Até cinco palavras por ronda.</p>' +
    action(
      "start-" + focus.id,
      complete(state, focus)
        ? "Voltar a jogar"
        : started
          ? "Continuar a jogar"
          : "Começar a jogar",
    ) +
    "</section>" +
    '<div class="section-title"><h2>Níveis</h2><span>' +
    total +
    ` / ${wordTotal} palavras fixadas</span></div><div class="levels">` +
    levels
      .map((l) => {
        const open = unlocked(state, l),
          count = fixedCount(state, l);
        const status = !open
          ? "Conclui o nível " + (Number(l.id) - 1)
          : complete(state, l)
            ? "Concluído · Voltar a jogar"
            : count + " de " + l.words.length + " fixadas";
        return (
          '<button class="level" data-action="start-' +
          l.id +
          '" ' +
          (open ? "" : "disabled") +
          '><span class="number">' +
          l.id +
          '</span><span class="level-text"><strong>' +
          esc(l.name) +
          "</strong><small>" +
          status +
          '</small></span><span class="quantity">' +
          l.words.length +
          ' palavras</span><span class="trail" aria-hidden="true">' +
          (open ? "›" : "–") +
          "</span></button>"
        );
      })
      .join("") +
    "</div>"
  );
}
function roundTop(level, s) {
  const pos = Math.min(s.cursor + 1, s.cards.length);
  return (
    '<div class="nav"><button class="back" data-action="home"><span aria-hidden="true">‹</span> Níveis</button><span>Palavra ' +
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
    over(level)
  );
}
function play(level, s) {
  if (s.cursor >= s.cards.length) return summary(level, s);
  const card = s.cards[s.cursor],
    word = level.words.find((w) => w.id === card.id);
  const answered = s.answers.length > s.cursor,
    value = s.answers[s.cursor],
    correct = value === word.key;
  const top = roundTop(level, s);
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
      esc(word.key) +
      '</p><div class="example"><h2>Exemplo</h2><blockquote>' +
      esc(word.example) +
      "</blockquote></div>" +
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
function summary(level, s) {
  const fixed = fixedCount(state, level),
    done = complete(state, level),
    score = roundScore(s, level);
  const following = levels[Number(level.id)];
  const title = s.replay
    ? "Revisão concluída"
    : done
      ? "Nível concluído!"
      : "Ronda concluída";
  const subtitle =
    done && !s.replay
      ? following
        ? "Desbloqueaste o nível " + following.id + " · " + following.name + "."
        : `Fixaste as ${wordTotal} palavras do jogo.`
      : "Dois acertos fixam uma palavra. As que falhares voltam noutra ronda.";
  return (
    header() +
    '<section class="summary">' +
    over(level) +
    "<h1>" +
    title +
    '</h1><div class="score">' +
    score +
    "<span> / " +
    s.cards.length +
    "</span></div><p>respostas certas</p></section>" +
    '<div class="track"><i style="width:' +
    (fixed / level.words.length) * 100 +
    '%"></i></div><p class="stats">' +
    fixed +
    " de " +
    level.words.length +
    ' palavras fixadas</p><p class="description">' +
    esc(subtitle) +
    "</p>" +
    action(
      "continue",
      done && following && !s.replay
        ? "Jogar o nível " + following.id
        : done
          ? "Voltar aos níveis"
          : "Jogar outra ronda",
    ) +
    (!done
      ? '<button class="unsure" data-action="close">Voltar aos níveis</button>'
      : "")
  );
}
function render(focus = false) {
  const level = current(),
    s = level && state.sessions[level.id];
  root.classList.toggle("in-round", Boolean(s && s.cursor < s.cards.length));
  root.innerHTML = s ? play(level, s) : home();
  if (!s) root.append(document.querySelector("#credits").content.cloneNode(true));
  window.scrollTo(0, 0);
  if (focus) {
    const h = root.querySelector(".result") ?? root.querySelector("h1");
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}
function goHome() {
  if (!state.active) return false;
  state.active = null;
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
  const id = target.dataset.action,
    l = current();
  if (id === "home") {
    goHome();
    return;
  }
  if (id.startsWith("start-"))
    start(
      state,
      levels.find((v) => v.id === id.slice(6)),
    );
  else if (l) {
    const s = state.sessions[l.id];
    if (id.startsWith("answer-"))
      answer(state, l, s.cards[s.cursor].options[Number(id.slice(7))]);
    else if (id === "unsure") answer(state, l, null);
    else if (id === "next") next(state, l);
    else if (id === "continue" || id === "close") {
      const done = complete(state, l),
        replay = s.replay,
        following = levels[Number(l.id)];
      finish(state, l);
      if (id === "continue" && !replay) {
        if (!done) start(state, l);
        else if (following) start(state, following);
      }
    }
  }
  save();
  render(true);
});
render();
