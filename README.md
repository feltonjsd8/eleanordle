# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:
# Start the development server
# Eleanordle

Eleanordle is a Wordle-inspired word-guessing game included in this React app. Players attempt to guess a hidden word within a limited number of tries. The game provides feedback after each guess to help narrow down the correct answer.

## How to play

- You have 6 attempts to guess the target word.
- Each guess must be a valid word of the same length as the target.
- After submitting a guess, each letter will be marked:
	- Green: correct letter in the correct position.
	- Yellow: correct letter in the wrong position.
	- Gray: letter not present in the word.
- Use the feedback to refine subsequent guesses until you find the word or run out of attempts.

## Game features

- Multiple categories (themes) for target words.
- Keyboard input and on-screen keyboard support.
- Visual, color-coded feedback for each guess.
- A simple modal with word definitions/clues when available.

## Running the app locally

This project is a standard Create React App. From the project root:

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser to play.

## Daily and ladder content database

Daily mode and ladder mode now read their word pools from a bundled SQLite database instead of selecting directly from in-app arrays or live API results.

- Database file: `public/game-content.sqlite`
- SQLite runtime asset: `public/sql-wasm.wasm`
- Browser loader: `src/services/gameDatabase.js`
- Selection/lookup logic: `src/services/dictionaryService.js`
- Population script: `scripts/gameDb.mjs`

The bundled database currently contains:

- `daily`: 3000 five-letter words with definitions
- `ladder`: 3000 total words with definitions, split across 4, 5, and 6 letters
- Each row also includes a `difficulty` rating from `1` (easier clue) to `5` (harder clue)

### Populate from Datamuse

To rebuild the database from Datamuse:

```bash
npm run db:populate
```

This fetches Datamuse words and definitions, filters profanity, writes the SQLite database, and copies the `sql.js` wasm asset into `public`.

### Select or override words manually

You can update or disable specific entries in the database without regenerating the full dataset.

Upsert a word:

```bash
npm run db:upsert -- --game daily --word APPLE --definition "A round fruit" --part-of-speech noun
```

You can also override the automatic rating:

```bash
npm run db:upsert -- --game daily --word APPLE --definition "A round fruit" --difficulty 1
```

Refresh schema and backfill difficulty ratings on the existing database:

```bash
npm run db:migrate -- --force true
```

Remove any rows where the definition gives away the answer word, or where the word/definition contains profanity:

```bash
npm run db:prune
```

Disable a word:

```bash
npm run db:disable -- --game ladder --word GRAPE
```

Supported game values are `daily` and `ladder`.

Daily mode uses a deterministic hash of the date to choose one enabled `daily` entry. Daily ladder uses the enabled `ladder` entries for 4, 5, and 6-letter stages, also chosen deterministically by date.

## Where to look in the code

- The main game components are in `src/components` (Wordle, WordModal, DefinitionModal).
- Word and suggestion logic is in `src/services`.

## Contributing

If you'd like to add categories, words, or features, please open an issue first or submit a pull request.

## License

MIT
