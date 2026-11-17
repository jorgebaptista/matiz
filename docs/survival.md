# Survival

Each correct answer earns one point. A mistake or skip ends the run after showing the answer. Clearing every card wins. There is no timer.

A run draws three regular words from each introductory band, then every regular word in the hardest band. Each word appears once. Daily words stay in the daily and practice pools. **Play again** draws a fresh challenge. Survival saves its own run and personal best per language and pack version.

Challenge links contain the seed, pack version and score to beat. The same seed and version produce the same cards and choices on web and Android. A link resumes the player's first attempt or shows its finished result, even after other runs. Scores and attempt history are stored on the device.

Builds automatically preserve regular words in `archives/survival/<locale>/<version>.json`. Commit newly generated archives with content changes. Keep earlier snapshots. The builder checks each snapshot against its version and includes it in that edition's offline game. The website also serves the JSON under `challenges/`. Older links keep their questions after words are edited or removed.

The version covers words, band placement, choices, examples and draw rules. Review credits may be updated in archives without changing questions. Reviewed builds check archived content too. If the draw rules change, retain support for `s1` while adding a new version. An older app needs an update to open a newer challenge.

Tests cover shared decks, failures, resume, best scores, invitation validation and both language interfaces. Set `SITE_URL` for your host when building web or Android. Android also uses it for incoming challenge links. Opening HTTPS links in the app depends on Android's supported-link settings.
