import { mkdtemp, mkdir, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { projectRoot } from "../scripts/content.mjs";

// Deliberately overlaps a PT-PT ID to prove storage cannot bleed between packs.
export const fixturePack = {
  locale: "en-GB",
  levels: [{ id: "0", name: "First steps", words: [{
    id: "ponderar", word: "ponder", answer: "consider",
    alternatives: ["confirm", "forget", "promise"],
    example: "She paused to ponder the two options.", origin: "human-written", status: "pilot",
  }] }],
};

export const fixtureLocale = {
  locale: "en-GB", languageName: "British English", title: "Matiz · Synonyms",
  description: "New words and reviews in rounds of up to five.",
  strings: {
    daily: "Daily challenge", dailyHint: "4 words, from easiest to hardest",
    dailyDebut: "New words", dailyEncore: "Encore",
    editionHeading: "A synonym game in British English", editionPlay: "Play in English",
    editionNote: "Free · No account · Progress saved on this device",
    sampleLabel: "A word from the game", revealSynonym: "Reveal the synonym",
    howToPlay: "How to play", howToPlayText: "Pick a synonym, then see the word in a sentence.",
    contributionHeading: "Want to add a word or a language?", suggestWord: "Suggest a word", addLanguage: "Add a language",
    brand: "Matiz", storageAlert: "Progress is saved only while this page remains open.",
    entryBand: "Entry", entryBadge: "E", level: "Level {id}", learned: "Learned",
    learning: "Learning", unseen: "Undiscovered", reviewAvailable: "Review available.",
    nextReview: "Next review · {when}", reviewAfter: {
      one: " or after {count} other question, whichever is earlier",
      other: " or after {count} other questions, whichever is earlier",
    },
    heroTitle: "Synonyms", heroArt: "aáa", resume: "Continue round", play: "Play",
    yourWords: "Your words", learnedTotal: "{count} / {total} learned",
    seenTotal: { one: "{count} of {total} seen", other: "{count} of {total} seen" },
    home: "Home", wordPosition: "Word {count} of {total}", practice: "Free practice",
    correct: "Correct!", skipped: "Good to know", incorrect: "Not this time", example: "Example",
    yourAnswer: "You chose “{answer}”.", result: "View result", nextWord: "Next word",
    prompt: "Which meaning is closest?", unsure: "I don't know", roundComplete: "Round complete",
    correctAnswers: "correct answers", playAgain: "Play another round", backHome: "Back home",
    credits: "Credits and licences", downloadGame: "Download for offline play", openquizLabel: "OpenQuiz.",
    openquizCredit: "Thanks to OpenQuiz contributors for option shuffling and answer tracking. Distributed under MIT.",
    magooshLabel: "Magoosh Vocabulary Builder.",
    magooshCredit: "Inspired the rounds and level progression. These English questions are test fixtures.",
    typographyLabel: "Typography.", typographyCredit: "DM Sans and Instrument Serif, by their project authors, under SIL OFL.",
    licenseMatiz: "Matiz · MIT", licenseOpenquiz: "OpenQuiz · MIT",
    licenseDMSans: "DM Sans · SIL OFL", licenseInstrumentSerif: "Instrument Serif · SIL OFL",
  },
};

/** Create a disposable two-locale tree without adding a shipped second pack. */
export async function languageFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "matiz-languages-"));
  for (const folder of ["packs", "locales", "editorial"]) {
    await mkdir(path.join(root, folder));
    await copyFile(path.join(projectRoot, folder, "pt-PT.json"), path.join(root, folder, "pt-PT.json"));
  }
  await writeFile(path.join(root, "packs/en-GB.json"), JSON.stringify(fixturePack));
  await writeFile(path.join(root, "locales/en-GB.json"), JSON.stringify(fixtureLocale));
  await writeFile(path.join(root, "editorial/en-GB.json"), JSON.stringify({
    locale: "en-GB", words: [{
      id: "draft-only", word: "draft-only", answer: "unpublished",
      alternatives: ["first", "second", "third"], example: "A draft-only example.",
      origin: "human-written", status: "draft", targetLevel: 0,
      sense: "Unpublished test content.", references: ["https://example.org/draft-only"],
    }],
  }));
  return { root, outdir: path.join(root, "dist") };
}
