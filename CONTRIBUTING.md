# Contributing to Matiz

[Build and test locally](docs/development.md) · [Add a language](docs/languages.md)

Choose words that help fluent speakers express themselves more precisely. Uncommon words should add a useful meaning or register.

**Add a language.** Translate the interface, write questions or review a pack. Follow the [language-pack guide](docs/languages.md).

**Contribute a feature.** [Open an issue](https://github.com/jorgebaptista/matiz/issues/new/choose) with an example, or a focused PR with tests for changed behaviour. Practice rules live in `src/game.js` and `tests/game.test.mjs`. Check interface changes at phone width and update translations. Credit borrowed code and data, including their licences.

## Suggest a word

Open an issue with a word, the sense you have in mind and an example. Or copy the *alvitrar* entry in `editorial/pt-PT.json` into a new entry and open a pull request. Drafts never enter the playable pack automatically.

- Give the entry a permanent ID, one best answer, three plausible alternatives and an original example in the edition’s language.
- Check the intended sense against a reference and record the link. Write the example and explanation yourself. Use `origin: "ai-drafted"` for an AI draft, including after someone edits or reviews it, or `"human-written"` for an original human draft.
- Set `status` to `draft` and suggest a numeric `targetLevel`. Run `npm run content:check`.

## Review words and levels

A fluent reviewer plays each question before reading the example. Replace alternatives that could also be correct: players see only the headword. Check part of speech, register and idiomatic usage.

Move reviewed questions from the queue to the appropriate level. Remove `targetLevel`, set `status` to `reviewed` and add `reviewedBy` with the reviewer's agreed public credit. Keep the original drafting credit, intended sense and references. For existing `pilot` entries, add those review fields in place.

Place each band in the pack in order of difficulty. Give it a unique, stable numeric string ID and a display name. Pick as many reviewed words as fit the band. The game calculates totals and deals up to five words per round across all bands. Preserve published IDs so existing players keep their word histories and saved rounds. Changes to a live answer or its choices need a saved-round compatibility check before release.

Run the [development checks](docs/development.md#checks) before submitting a pack change.

## Schedule daily words

Add one new question to each of bands 0 through 3 with the same `dailyOn` date in `YYYY-MM-DD` format. Submit complete dates and run `npm run content:check`. Publish the web bundle and APK before the first date; older installs keep cycling through their bundled sets offline.

## Pull requests

Fork the repository and open a focused PR against `main`. Use a Conventional Commit title, such as `fix: restore a saved round`. Keep the branch up to date, pass the `check` job and resolve review conversations before merging. For content changes, commit the generated challenge archives along with the pack.
