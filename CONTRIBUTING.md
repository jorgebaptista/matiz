# Contributing to Matiz

## Choose a difficulty

Rate the question as a fluent speaker of that edition. Consider how familiar the word is **and** what the player must distinguish before seeing the example.

| Band | What earns this level | British English · European Portuguese |
| --- | --- | --- |
| 0 · Entry / Inicial | An everyday word with a direct, familiar synonym. | *mend* · *adiar* |
| 1 · Easy / Fácil | A word common in conversation or general reading. The player recognises its usual sense among related choices. | *candid* · *prudente* |
| 2 · Medium / Médio | A less familiar sense or a finer distinction. The closest wrong answer should make a fluent reader pause. | *tentative* · *tácito* |
| 3 · Hard / Difícil | A precise or less common word worth using. A player must know the shade of meaning that rules out the strongest alternative. | *diffidence* · *perfunctório* |

For *diffidence*, offer *self-doubt*, *discretion*, *deference* and *indifference*. All four can explain someone's silence. Only *self-doubt* captures their lack of confidence. If length or grammar gives away the answer, rewrite the choices. If two answers fit a common sense, replace one. Pick the band separately in each language.

## Suggest or review a word

Use the [word form](https://github.com/jorgebaptista/matiz/issues/new?template=word.yml) or the edition’s `editorial/<locale>.json` queue. The [PT-PT draft](editorial/pt-PT.json) shows the format.

- Give the word a stable ID, intended sense, suggested `targetLevel`, one best answer, three plausible alternatives, an original example and a dictionary link.
- Mark suggestions `draft`. Keep the original `origin` credit (`human-written` or `ai-drafted`) after editing.
- A fluent reviewer tries the choices before reading the example. Once approved, move the entry to its band in `packs/<locale>.json`, remove `targetLevel`, set `status` to `reviewed`, and add `reviewedBy` with the reviewer’s agreed public credit. Keep the sense and references. Review existing pilot entries in place.

## Daily sets

Use the same `dailyOn` date (`YYYY-MM-DD`) for one new word in each band, 0–3. Ship the batch to web and Android before its first date. Preserve published IDs when moving words. If you edit published choices, check that a saved round still scores its original answer.

## Other contributions

[Add a language](docs/languages.md) or [suggest a feature](https://github.com/jorgebaptista/matiz/issues/new/choose). For game rules, start in `src/game.js` and `tests/game.test.mjs`. Check interface changes at phone width, translate player-facing text and credit borrowed material.

Run `npm run content:check`, `npm test`, `npm run build` and `npm run test:browser`. Use `npm run build:reviewed` when all packs have passed editorial review.
