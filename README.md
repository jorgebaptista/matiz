# Matiz

An offline synonym game for fluent speakers, starting with European Portuguese. Open the game and play a round of up to five words. Each word has four choices, a skip option and an original example sentence. Two correct encounters fix a word. A miss or skip resets that word. Complete a level to unlock the next, or replay a completed level for practice.

The first pack contains 60 words across three levels (10, 20 and 30). Progress, shuffled choices and the current answer are saved on the device. Android and the standalone browser file have separate saves.

## Build and play

Use Node.js 22.14 or later. From the repository root:

```sh
npm ci
npm run build
```

Open `dist/index.html` in a browser. The game, fonts and notices are bundled in this one file.

For Android, install JDK 17 or 21 and Android SDK Platform 34. Set `ANDROID_HOME`, then run `gradlew.bat assembleDebug` from `android` on Windows or `./gradlew assembleDebug` on macOS/Linux. The task builds the same game into `android/build/outputs/apk/debug/matiz-debug.apk`. This offline Android package requests no network permission. The debug build is for personal testing.

## Content and reuse

Edit `packs/pt-PT.json` to change the words. Each row holds the target, the best match, three alternatives and an example. The content and game UI are original, released under MIT. PT-PT is the first playable pack and UI language.

Matiz uses the MIT-licensed [OpenQuiz scheduler and shuffle](https://github.com/ndunl075/OpenQuiz/tree/483bd789c2f27e9b457bd493d51125676b90b657/src/lib). `vendor/openquiz` preserves its source and licence at that revision. Matiz uses the upstream answer update and round selection, with five-question rounds and its own two-hit level progression. DM Sans and Instrument Serif are distributed under the SIL Open Font License. The font notices live in `vendor/fonts` and are bundled in the game.

## Verify

Run `npm test` for content checks and progress rules. After building, run `npx playwright install chromium` and `npm run test:browser` to verify play, interruption, persistence and unlocking at phone width. `MATIZ_BROWSER` can point to an installed Chromium browser. `MATIZ_CDP` can point to the forwarded WebView debugging endpoint of a fresh Android test emulator to run the same checks inside the installed APK.
