# Contributing words and levels

Matiz helps fluent speakers find a more precise way to say something. A good candidate is a word you might use in a conversation, an essay or a letter. A rare word earns its place when its meaning or register adds something.

## Suggest a word

Open an issue with a word, the sense you have in mind and an example. Or copy the *alvitrar* entry in `editorial/pt-PT.json` into a new entry and open a pull request. Drafts never enter the playable pack automatically.

- Give the entry a permanent ID, one best answer, three plausible alternatives and an original PT-PT example.
- Check the intended sense against a reference and record the link. Write the example and explanation yourself. Use `origin: "ai-drafted"` for an AI draft, including after someone edits or reviews it, or `"human-written"` for an original human draft.
- Set `status` to `draft` and suggest a numeric `targetLevel`. Run `npm run content:check`.

## Review and add a level

A fluent European Portuguese reviewer plays the question before looking at the example. Can they defend a second option for another common sense of the word? The player sees only the headword, so replace ambiguous alternatives. Check part of speech, register and idiomatic usage. Read the example aloud and consider where you would use the word yourself.

When a question is ready, move it from the queue to the appropriate level in `packs/pt-PT.json`, remove `targetLevel`, set `status` to `reviewed` and add `reviewedBy` with the reviewer's agreed public credit. Keep the original drafting credit, intended sense and references. For each existing `pilot` entry, add those review fields in place. A passing content check verifies the fields. People judge the language.

Place each band in the pack in order of difficulty. Give it a unique, stable numeric string ID and a display name. Pick as many reviewed words as fit the band. The game calculates totals and deals up to five words per round across all bands. Preserve published IDs so existing players keep their word histories and saved rounds. Changes to a live answer or its choices need a saved-round compatibility check before release.

Run `npm run content:check`, `npm test`, `npm run build` and `npm run test:browser` before submitting a pack change. To build a fully reviewed edition, use `npm run build:reviewed`. That command requires a review credit and a reference for every playable word. Opening the source repository can happen independently.
