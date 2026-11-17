# Build and test

Use Node.js 22.14 or later. From the repository root:

```sh
npm ci
npm run build
```

Open `dist/index.html` for European Portuguese or `dist/en-GB/index.html` for British English. Each file includes the game, fonts and notices. On the website and Android, switch editions from the home screen. Each language keeps its own progress.

## Checks

```sh
npm run content:check
npm run archives:check
npm test
npm run build:site
npx playwright install chromium
npm run test:browser
node tests/site.mjs
```

For content changes, build first and commit the generated challenge archives. Keep older archives so shared links continue to work.

Browser tests cover play, interruption, persistence and the word collection at phone width. Set `MATIZ_BROWSER` to an installed Chromium browser, or `MATIZ_CDP` to the forwarded WebView debugging endpoint of a fresh Android test emulator to test inside the APK.

`npm run build:reviewed` builds only when every playable word has its review credit and reference. The public pilot also includes questions awaiting editorial review.

## Android

Install JDK 17 or 21 and Android SDK Platform 34. Set `ANDROID_HOME`, then run `./gradlew assembleDebug` from `android` (`gradlew.bat assembleDebug` on Windows).

The task builds the game into `android/build/outputs/apk/debug/matiz-debug.apk`. This offline package requests no network permission. Debug builds are for personal testing; browser and Android saves are separate.

Before public Android distribution, prepare a signed release and a way for pilot players to carry their progress across signing or platform changes. [Android app signing](https://developer.android.com/studio/publish/app-signing)

## Next steps

- Review pilot questions with native speakers, especially ambiguous choices and word usefulness.
- Welcome contributor-led language packs and improve the guide through their feedback.
- Test whether players can use learned words in fresh sentences.

[Contributing](../CONTRIBUTING.md) · [Website and launch guide](launch.md)
