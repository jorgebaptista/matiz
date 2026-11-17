# Contributing to Matiz

[Build and test locally](docs/development.md) · [Add a language](docs/languages.md)

Choose words that help fluent speakers express themselves more precisely. Uncommon words should add a useful meaning or register.

**Add a language.** Translate the interface, write questions or review a pack. Follow the [language-pack guide](docs/languages.md).

**Contribute a feature.** [Open an issue](https://github.com/jorgebaptista/matiz/issues/new/choose) with an example, or a focused PR with tests for changed behaviour. Practice rules live in `src/game.js` and `tests/game.test.mjs`. Check interface changes at phone width and update translations. Credit borrowed code and data, including their licences.

## Choose a difficulty

Rate the whole question for a fluent speaker of that edition. Consider the word, the sense being tested and how close the choices are.

| Band | What the player needs to recognise | English · Português |
| --- | --- | --- |
| 0 · Entry / Inicial | An everyday word and a familiar synonym. | *mend* · *adiar* |
| 1 · Easy / Fácil | The usual sense of a word common in conversation or general reading. | *candid* · *moroso* |
| 2 · Medium / Médio | A less familiar sense or a distinction between related words. | *tentative* · *tácito* |
| 3 · Hard / Difícil | A precise or uncommon meaning that separates the answer from a plausible alternative. | *equanimity* · *circunlóquio* |

For example, *equanimity* means composure. Indifference can also look calm, but someone can care deeply and still show equanimity. Aim for that kind of distinction in a Hard question.

## Suggest a word

Open an issue with a word, the sense you have in mind and an example. Or copy the *alvitrar* entry in `editorial/pt-PT.json` into a new entry and open a pull request. Drafts never enter the playable pack automatically.

- Give the entry a permanent ID, one best answer, three plausible alternatives and an original example in the edition’s language.
- Check the intended sense against a reference and record the link. Write the example and explanation yourself. Use `origin: "ai-drafted"` for an AI draft, including after someone edits or reviews it, or `"human-written"` for an original human draft.
- Set `status` to `draft` and suggest a numeric `targetLevel`. Run `npm run content:check`.

## Review words and levels

Read the word and all four choices before looking at the example. Try to defend each alternative, including in other common senses of the word. Replace any competing synonym. If the intended reading needs context, add a short `phrase` such as “lavish spending”. It appears with the word before the player answers. A clear word needs no phrase.

Keep the choices comparable in grammar and specificity. The example after the answer should illustrate the same sense. A fluent reviewer should be able to explain why one choice fits best without seeing that example.

Move reviewed questions from the queue to the appropriate level. Remove `targetLevel`, set `status` to `reviewed` and add `reviewedBy` with the reviewer's agreed public credit. Keep the original drafting credit, intended sense and references. For existing `pilot` entries, add those review fields in place.

Place each band in the pack in order of difficulty. Give it a unique, stable numeric string ID and a display name. Pick as many reviewed words as fit the band. The game calculates totals and deals up to five words per round across all bands. Preserve published IDs so existing players keep their word histories and saved rounds. Changes to a live answer or its choices need a saved-round compatibility check before release.

Run the [development checks](docs/development.md#checks) before submitting a pack change.

## Schedule daily words

Add one new question to each of bands 0 through 3 with the same `dailyOn` date in `YYYY-MM-DD` format. Submit complete dates and run `npm run content:check`. Publish the web bundle and APK before the first date; older installs keep cycling through their bundled sets offline.

## Pull requests

Fork the repository and open a focused PR against `main`. Use a Conventional Commit title, such as `fix: restore a saved round`. Keep the branch up to date, pass the `check` job and resolve review conversations before merging. For content changes, commit the generated challenge archives along with the pack.
