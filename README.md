# Matiz

[Play Matiz](https://jorgebaptista.github.io/matiz/) · [Jogar em português europeu](https://jorgebaptista.github.io/matiz/editions/pt-PT/) · [Play in British English](https://jorgebaptista.github.io/matiz/editions/en-GB/)

An open-source synonym game for people who want a richer vocabulary in a language they already speak. Choose the closest synonym, read an example and revisit words over time. Play in European Portuguese or British English. [Add a language](docs/languages.md) · [Suggest a word or feature](https://github.com/jorgebaptista/matiz/issues/new/choose)

Both editions have four difficulty bands. Daily words join regular practice the day after they debut. Your browser and the Android app each save your progress and unfinished rounds.

## Practice schedule

The daily challenge introduces four words in each edition, from easiest to hardest. The first 30 sets run from 17 November through 16 December 2026. At midnight in Lisbon each set joins regular practice, even for players who missed it. On unscheduled days, earlier sets loop in order as **Encore** or **Revisita**. A newly scheduled set takes priority. Web and Android use the same bundled calendar offline. Today's attempt and score are saved separately from practice.

A round contains up to five words. Due reviews take priority over new words. After a miss or **Não sei**, the word becomes eligible again after five other answers or ten minutes, whichever comes first. Both carry over between rounds and visits. Getting a scheduled retry right sets a review for the next day. Later successful scheduled reviews use intervals of 3, 7, 14 and 30 days. An extra retry from free practice preserves the original review date. A word remains eligible for review after it is marked **Aprendida**.

Repeated retrieval improved delayed vocabulary recall in an experiment with word pairs. A separate spacing experiment found that the best review gap depended on how long the material had to be remembered. Neither study tested Matiz's multiple-choice game, level sizes or exact intervals. Those are pilot settings. [Karpicke and Roediger](https://doi.org/10.1126/science.1152408) · [Cepeda et al.](https://doi.org/10.1111/j.1467-9280.2008.02209.x)

For new play, **Aprendida** records a successful scheduled review after an earlier correct answer. Old saves keep their previously fixed words and unfinished rounds. Matiz estimates the first review date for each previously seen word from its saved timestamp and progress.

## Build and play

Use Node.js 22.14 or later. From the repository root:

```sh
npm ci
npm run build
```

Open `dist/en-GB/index.html` for British English or `dist/index.html` for European Portuguese. Each file includes its game, fonts and notices. On the website and Android, use the language menu on the game’s home screen. Each language keeps its own progress.

For Android, install JDK 17 or 21 and Android SDK Platform 34. Set `ANDROID_HOME`, then run `gradlew.bat assembleDebug` from `android` on Windows or `./gradlew assembleDebug` on macOS/Linux. The task builds the same game into `android/build/outputs/apk/debug/matiz-debug.apk`. This offline Android package requests no network permission. The debug build is for personal testing.

## Content and reuse

Each question records its origin and review status. The current packs are AI-drafted pilots. The original content and game UI are licensed under MIT. [How we choose difficulty and review words](CONTRIBUTING.md#choose-a-difficulty)

## Roadmap

1. Review the pilot in small batches with native speakers. Ask testers which choices also seemed correct and which words they would actually use.
2. Try another band of more demanding, useful words. Use Portuguese frequency and register as starting points, then adjust the difficulty based on playtests. Keep rounds at up to five words. Later, test whether players can use a word in a fresh sentence.
3. The public web pilot includes the original questions awaiting editorial review. Run `npm run build:reviewed` for a fully reviewed edition. Prepare a signed Android release and a way for pilot players to carry their progress across signing or platform changes before distributing it. [Android app signing](https://developer.android.com/studio/publish/app-signing)
4. Welcome a first contributor-led language pack and use the experience to improve the guide. [Language packs](docs/languages.md)

For the playable website, run `npm run build:site`. The maintainer guide covers local preview, publication, search indexing and the first community posts. [Website and launch guide](docs/launch.md)

## Credits

Thank you to the [OpenQuiz contributors](https://github.com/ndunl075/OpenQuiz). Matiz uses their code to shuffle answer choices and track answers. The [upstream revision](https://github.com/ndunl075/OpenQuiz/tree/483bd789c2f27e9b457bd493d51125676b90b657/src/lib) and [MIT copyright notice](vendor/openquiz/LICENSE) identify the code included in this build.

[Magoosh Vocabulary Builder](https://magoosh.com/vocabulary-builder/) inspired the short rounds and unlockable levels. The Portuguese and English questions and examples were written for Matiz.

The typefaces are [DM Sans](https://github.com/googlefonts/dm-fonts) and [Instrument Serif](https://github.com/Instrument/instrument-serif). Their authors' [DM Sans](vendor/fonts/dmsans-OFL.txt) and [Instrument Serif](vendor/fonts/instrumentserif-OFL.txt) licence notices are included. Players can read all bundled notices offline under **Créditos e licenças** on the levels screen.

## Verify

Run `npm test` for content checks and progress rules. After building, run `npx playwright install chromium` and `npm run test:browser` to verify play, interruption, persistence and the word collection at phone width. `MATIZ_BROWSER` can point to an installed Chromium browser. `MATIZ_CDP` can point to the forwarded WebView debugging endpoint of a fresh Android test emulator to run the same checks inside the installed APK.
