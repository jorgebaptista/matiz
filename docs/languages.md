# Contribute a language

Matiz uses one game engine and two JSON files per language. European Portuguese and British English ship with the game. The examples below show how the English files are structured; use your own locale tag when adding an edition.

## 1. Choose the locale and create the files

Use a canonical BCP47 tag, including its usual case: `en-GB`, `fr-FR` or `pt-BR`. Check it locally with `node -p "Intl.getCanonicalLocales('en-GB')[0]"`. The tag must match both filenames and both `locale` fields exactly.

Add:

- `packs/en-GB.json`: playable vocabulary, levels and editorial credits.
- `locales/en-GB.json`: complete interface translation and page metadata.
- Optionally, `editorial/en-GB.json`: suggestions still being drafted.

No engine changes, build registration or package-script changes are needed. Every pack needs its matching locale file. Orphan locale or draft files fail validation. If a translation is still incomplete, keep it on a contribution branch until both files are ready; there is no automatic fallback to Portuguese.

## 2. Write a playable pack

A minimal English pack has this shape:

```json
{
  "locale": "en-GB",
  "levels": [
    {
      "id": "0",
      "name": "First steps",
      "words": [
        {
          "id": "ponder-consider",
          "word": "ponder",
          "answer": "consider",
          "alternatives": ["confirm", "forget", "promise"],
          "example": "She paused to ponder the two options.",
          "origin": "human-written",
          "status": "pilot"
        }
      ]
    }
  ]
}
```

Write original questions for fluent speakers of the language. The player sees the headword before the example: check that only one option is defensible without that context. The correct answer and three alternatives must differ from one another and the target, ignoring case and surrounding whitespace. Duplicate targets and IDs are rejected across a locale's playable and draft entries.

Give each level a name, a unique numeric string ID and at least one word. List levels in difficulty order and keep published IDs stable. Small packs can start with a single band. For daily challenges, use all [four difficulty bands](../CONTRIBUTING.md#choose-a-difficulty).

`origin` is `human-written` or `ai-drafted`; preserve the original drafting credit after editing. Playable status is `pilot` or `reviewed`. For `reviewed`, also supply an original `sense`, one or more HTTPS `references`, and `reviewedBy` with the native-language reviewer's agreed public credit. Normal builds retain the current pilot policy. `npm run build:reviewed` rejects any playable pilot question in any locale. Field checks cannot establish translation quality or resolve ambiguous synonyms; a fluent speaker must play and review them.

## 3. Translate every interface string

Copy a shipped locale file to a new file named for your language, update its locale and metadata, and translate **every** value in `strings`. Keep all key names. These top-level fields are the stable interface for the separate static site generator:

```json
{
  "locale": "en-GB",
  "languageName": "British English",
  "title": "Matiz · Synonyms",
  "description": "New words and reviews in rounds of up to five."
}
```

That snippet shows metadata only: your actual file must also contain the complete `strings` object copied from PT-PT. `languageName` is the language's own name (endonym); it appears in the game's header. `title` becomes the HTML title. `description` supplies both the HTML description and the game's introduction. Keep them plain text.

Translate prompts, buttons, collection/status labels, feedback, review text, the storage warning and all visible credits labels and explanatory text. `heroArt` supplies the decorative letters; use three characters that fit the language. Credit the upstream projects accurately and adapt the sentence about who wrote the language's questions. The four original legal notice bodies remain bundled unchanged from the repository's licence files; translators change their visible headings only.

Templates use named placeholders. Keep each name and its occurrence count exactly as in PT-PT; reorder them freely. For example:

```json
"wordPosition": "Word {count} of {total}",
"yourAnswer": "You chose “{answer}”.",
"nextReview": "Next review · {when}",
"reviewAfter": {
  "one": " or after {count} other question, whichever is earlier",
  "other": " or after {count} other questions, whichever is earlier"
}
```

Any message containing `{count}` may be a plain template or a plural object. A plural object must include every cardinal category used by the locale, including `other`. Find those categories with:

```sh
node -p "new Intl.PluralRules('en-GB').resolvedOptions().pluralCategories"
```

Each plural variant must retain the same placeholders. English needs `one` and `other`; other languages may require `zero`, `two`, `few` or `many`. Dates use the pack's locale. Plain strings and substituted values are escaped as text, so do not put HTML in translations.

## 4. Keep drafts separate

An optional `editorial/en-GB.json` has this shape:

```json
{
  "locale": "en-GB",
  "words": []
}
```

For each suggestion, use the same word fields, set `status` to `draft`, add an original `sense`, HTTPS `references`, and a nonnegative integer `targetLevel`. Drafts are checked alongside the pack but never bundled. Once reviewed, move an entry to a playable level, remove `targetLevel`, set `status` to `reviewed` and add `reviewedBy`. Preserve its origin and references.

## 5. Check, build and play

Use Node.js 22.14 or later and the repository's installed dependencies. Run from the repository root:

```sh
npm run content:check
npm test
npm run build
npm run test:browser
```

The checker validates every discovered locale, metadata identity, nonempty UI values, exact UI keys, placeholder names/counts, plural variants and content records. The builder runs the same checks before writing any HTML. Missing or invalid locales fail the whole build; they are never skipped. This catches structural gaps, while fluent-speaker review catches untranslated or unsuitable wording.

`npm run build` builds all `packs/*.json` using the shared engine:

| Pack | Standalone output | Site copy/link |
| --- | --- | --- |
| `pt-PT` | `dist/index.html` | `jogar/index.html` |
| `en-GB` | `dist/en-GB/index.html` | `jogar/en-GB/index.html` |

Each HTML file includes its own vocabulary, translated UI, JavaScript, CSS, fonts and notices. Open the file directly and play with networking disabled. No runtime locale fetch or language service is needed. The English home page lists each playable pack automatically. The site builder also creates `editions/<locale>/` with the translated title, description, sample question and play link. Use a fresh build output directory when retiring a locale; builds overwrite current files without purging old output folders.

Each edition keeps progress in `matiz.<locale>.v1` on the current device and browser. Android opens PT-PT on first launch, then remembers the language selected on the game's home screen. Downloaded HTML files open directly in their own language.

The desktop browser check uses Playwright Chromium by default. Install it with `npx playwright install chromium`. Set `MATIZ_BROWSER` to an installed Chromium executable to override it; for example in PowerShell, `$env:MATIZ_BROWSER = 'C:\Program Files\Google\Chrome\Application\chrome.exe'`. The existing PT-PT play and save-migration checks still run. A second test creates a temporary English pack, builds both languages and verifies translated offline play, plural text, credits, resume and save isolation on one simulated origin. It does not add or ship an English edition. Browser fixtures are skipped in the existing Android CDP mode; that mode retains its PT-PT device checks.

Before proposing a real locale, play its own `dist/<locale>/index.html` at phone width: finish a round, reload during feedback, return home, open the word collection, and read the credits. Have a fluent speaker check the wording and choices. The automated browser fixture proves the contribution mechanism; it does not certify each contributed language or Android device layout.
