# Survival

Each correct answer earns one point. A mistake or skip ends the run after showing the answer. Clearing every card wins. There is no timer.

A run draws three regular words from each introductory band, then every regular word in the hardest band. Each word appears once. Daily words stay in the daily and practice pools. Survival saves its own run and personal best per language and pack version.

Challenge links contain the seed, pack version and score to beat. The same seed and version produce the same cards and choices on web and Android. Scores are local and self-reported.

The version covers the regular words, band placement, choices, examples and deck rules. Editing those words changes it. Saved runs retain their original questions, but a link for a different version asks the player to update or request a new challenge. Keep the `s1` prefix in `src/survival.js` until the draw rules change, then increment it.

Tests cover shared decks, failures, resume, best scores, invitation validation and both language interfaces. Set `SITE_URL` for your host when building web or Android. Android also uses it for incoming challenge links. Opening HTTPS links in the app depends on Android's supported-link settings.
