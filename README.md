# Slovíčko — Czech → English vocabulary

A React + TypeScript + Material UI app for learning Czech–English vocabulary by CEFR level (A1–C2). Its word pool has **10,440 words**: 1,115 hand-curated pairs plus 9,325 entries generated from Wiktionary (`bun run wordbank`). It also uses Wiktionary live as an online dictionary.

| Level | A1 | A2 | B1 | B2 | C1 | C2 |
| --- | --- | --- | --- | --- | --- | --- |
| Words | 714 | 1,033 | 1,674 | 2,309 | 2,343 | 2,367 |

```bash
bun install
bun run dev        # http://localhost:5173
bun run build
bun run wordbank   # regenerate src/data/wordbank/*.json from Wiktionary (resumable)
```

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes the app on every push to `main`. The site lives at **https://tomashusarik.github.io/Slov-ko/**.

One-time setup: in the repository open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

The workflow sets `BASE_PATH=/<repository>/` for the build, which `vite.config.ts` uses as Vite's `base`. Local `bun run dev` keeps serving from `/`. To preview the Pages build locally:

```bash
BASE_PATH=/Slov-ko/ bun run build && BASE_PATH=/Slov-ko/ bunx vite preview   # http://localhost:4173/Slov-ko/
```

## Word pool

| Source | What | Level |
| --- | --- | --- |
| `src/data/vocabulary/*.ts` | hand-curated pairs with checked alternatives | hand-assigned |
| `src/data/wordbank/*.json` | generated from **Wiktionary** for the 15,000 most frequent Czech lemmas | by frequency rank |

`scripts/build-wordbank.ts` reads [Wiktionary:Frequency lists/Czech wordlist](https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Czech_wordlist), which lists the top 15,000 lemmas of the SYN2015 corpus from the Czech National Corpus. It then fetches each lemma's Wiktionary entry, 50 per API request, and keeps the English glosses of the word's main part of speech. Vulgar, obsolete, dialectal and descriptive glosses are dropped, as are placeholders such as "sb/sth", proper nouns and words already in the curated list. Progress is saved after each batch, so an interrupted run resumes where it stopped. Levels are assigned by rank: A1 ≤ 800, A2 ≤ 2,000, B1 ≤ 4,000, B2 ≤ 7,000, C1 ≤ 10,500, C2 for the rest.

The bank ships with the app, one lazy-loaded chunk per level. Pulling thousands of entries live from Wiktionary on every visit would be slow and would hit its rate limits. New sessions take curated words first, then the most frequent words you haven't seen yet.

## How it works

- **Session setup:** each new session first asks how many words to practise. You can pick a preset (10, 20, 50, 100 or all) or type any number.
- **Learning loop:** a Czech word is shown and you type the English translation. Matching ignores case, extra whitespace, trailing punctuation, hyphens versus spaces, and a leading `to` / `a` / `the`. Press `Enter` to check your answer. After every answer the card waits until you press `Enter` again or click **Next**.
- **Almost correct:** a small typo (one edit for words of 4–7 letters, two for longer words; swapped letters count as one) shows "Almost!" and lets you fix it once. A fixed answer costs 2 points but keeps your streak. Words of three letters or fewer get no tolerance, because changing one letter usually makes a different word.
- **Pronunciation:** English is played **only from real native-speaker recordings** (US/UK, from Wikimedia Commons via Wiktionary). There is no synthetic English voice: a word without a recording simply stays silent, and its 🔊 button is hidden. Recordings are prefetched while you think, so a click plays instantly. With auto-play on (header toggle), the answer's recording plays **once** when it is revealed, from the answer handler and never from a React effect. There is no synthetic voice at all, Czech or English.
- **Retry queue:** a word you miss or skip comes back 3 cards later and needs **two** clean answers before it counts as mastered. A correct answer given with hints is accepted, but the word comes back once more.
- **Hints:** each hint reveals one more letter of the canonical answer and costs 3 points. The last letter is never revealed.
- **Persistence (`localStorage`, prefix `vocapp:v1:`):** each level keeps its own in-progress session. A cross-session mistake history feeds "trouble words" back into new sessions. Preferences (level, theme, sound, pronunciation, last word count) are saved too.

## Structure

```
src/
  data/vocabulary/   curated word lists per level (a1.ts … c2.ts), one lazy chunk each
  data/wordbank/     generated Wiktionary word bank (a1.json … c2.json + meta.json)
  services/          VocabularyService (sources + fallback), dictionaryService (Wiktionary)
  session/           pure session reducer, session builder, mistake history
  hooks/             useVocabulary, usePersistentState, useLookup
  audio/             sfx.ts (synth cues), PronunciationProvider (English recordings)
  components/        AppHeader, LevelDrawer, PronunciationSettings, SessionSetup, PracticeSession, StatsBar, FlashCard, DictionaryPanel, HintMask, StreakBurst, SessionComplete
scripts/
  build-wordbank.ts  regenerates the word bank from Wiktionary (resumable)
```

### Online dictionary (Wiktionary)

Wiktionary is free, needs no API key and is CORS-enabled. Lookups go through `src/services/dictionaryService.ts`:

- **Synonym acceptance:** if an answer isn't in the word list, the English meanings Wiktionary lists for the Czech word are checked, so a correct synonym still counts (labelled "found in the dictionary").
- **Dictionary panel:** after each answer you see the English definition, an example sentence and other meanings of the Czech word (CC BY-SA, linked).
- **Recordings:** US/UK audio from Wikimedia Commons, served as mp3 transcodes so every browser can play them.

Requests are prefetched while you think, serialised with a 250 ms gap, back off for 60 s on HTTP 429, and are cached in `localStorage` for 30 days, including "not found" results. Any failure falls back silently to the word list. You can turn the dictionary off in the drawer; recordings are always looked up.

No free API offers Czech–English pairs **by CEFR level**, which is why the word bank is generated once, with frequency ranks standing in for levels.

### Remote vocabulary (optional)

Set `VITE_VOCAB_API_URL` to a base URL that serves `{a1..c2}.json` in the format `[{ "cs": "pes", "en": ["dog"] }]`. If the request fails, times out (4 s), returns the wrong shape or fewer than 10 words, the app uses the bundled curated dataset instead.
