import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');
const databasePath = path.join(publicDir, 'game-content.sqlite');
const wasmSourcePath = path.join(repoRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmTargetPath = path.join(publicDir, 'sql-wasm.wasm');
const datamuseApiUrl = 'https://api.datamuse.com/words';

const DAILY_TARGET_COUNT = 3000;
const LADDER_TARGETS = {
  4: 1000,
  5: 1000,
  6: 1000,
};

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const schemaSql = `
  CREATE TABLE IF NOT EXISTS game_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_mode TEXT NOT NULL,
    word TEXT NOT NULL,
    length INTEGER NOT NULL,
    definition TEXT NOT NULL,
    part_of_speech TEXT DEFAULT '',
    example TEXT DEFAULT '',
    difficulty INTEGER NOT NULL DEFAULT 3 CHECK(difficulty BETWEEN 1 AND 5),
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'datamuse',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_mode, word)
  );

  CREATE INDEX IF NOT EXISTS idx_game_words_lookup
    ON game_words (game_mode, length, enabled, sort_order, word);
`;

const parseArgs = (argv) => {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
};

const getSql = async () => initSqlJs({
  locateFile: (fileName) => path.join(repoRoot, 'node_modules', 'sql.js', 'dist', fileName),
});

const ensurePublicAssets = async () => {
  await fs.mkdir(publicDir, { recursive: true });
  await fs.copyFile(wasmSourcePath, wasmTargetPath);
};

const loadDatabase = async (SQL) => {
  try {
    const bytes = await fs.readFile(databasePath);
    return new SQL.Database(bytes);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    return new SQL.Database();
  }
};

const saveDatabase = async (db) => {
  const bytes = db.export();
  await fs.writeFile(databasePath, Buffer.from(bytes));
};

const getTableColumns = (db, tableName) => {
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  if (!result[0]) {
    return [];
  }

  const nameIndex = result[0].columns.indexOf('name');
  return result[0].values.map((row) => String(row[nameIndex] || ''));
};

const hasTableColumn = (db, tableName, columnName) => getTableColumns(db, tableName).includes(columnName);

const clampDifficulty = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 3;
  }

  return Math.max(1, Math.min(5, Math.round(numericValue)));
};

const getDefinitionTokens = (definition) => String(definition || '').toLowerCase().match(/[a-z]+/g) || [];

const buildWordVariants = (word) => {
  const normalizedWord = String(word || '').toLowerCase();
  const variants = new Set([normalizedWord]);

  if (normalizedWord.endsWith('es') && normalizedWord.length > 4) {
    variants.add(normalizedWord.slice(0, -2));
  }
  if (normalizedWord.endsWith('s') && normalizedWord.length > 3) {
    variants.add(normalizedWord.slice(0, -1));
  }
  if (normalizedWord.endsWith('ed') && normalizedWord.length > 4) {
    variants.add(normalizedWord.slice(0, -2));
  }
  if (normalizedWord.endsWith('ing') && normalizedWord.length > 5) {
    variants.add(normalizedWord.slice(0, -3));
  }

  return [...variants].filter((variant) => variant.length >= 3);
};

const containsProfanity = (value) => matcher.hasMatch(String(value || ''));

const definitionMentionsWord = (word, definition) => {
  const loweredDefinition = String(definition || '').toLowerCase();
  return buildWordVariants(word).some((variant) => loweredDefinition.includes(variant));
};

const rateDifficulty = ({ word, length, definition, partOfSpeech = '', rank = null }) => {
  let score = 3;
  const normalizedLength = Number(length || String(word || '').length || 0);
  const tokens = getDefinitionTokens(definition);
  const lowerDefinition = String(definition || '').toLowerCase();
  const normalizedPartOfSpeech = String(partOfSpeech || '').toLowerCase();

  if (normalizedLength <= 4) {
    score -= 1;
  } else if (normalizedLength >= 6) {
    score += 1;
  }

  if (Number.isFinite(rank)) {
    if (rank < 2) {
      score += 2;
    } else if (rank < 3) {
      score += 1;
    } else if (rank >= 4.5) {
      score -= 1;
    }
  }

  if (tokens.length <= 4) {
    score += 1;
  } else if (tokens.length >= 10) {
    score -= 1;
  }

  if (/(obsolete|archaic|poetic|dialect|rare|slang|mythology|botany|zoology|geology|chemistry|physics|mathematics)/i.test(lowerDefinition)) {
    score += 1;
  }

  if (definitionMentionsWord(word, definition)) {
    score -= 2;
  }

  if (normalizedPartOfSpeech === 'noun') {
    score -= 0.5;
  }

  return clampDifficulty(score);
};

const backfillDifficultyRatings = (db, { forceAll = false } = {}) => {
  const query = forceAll
    ? `
        SELECT id, word, length, definition, part_of_speech
        FROM game_words
      `
    : `
        SELECT id, word, length, definition, part_of_speech
        FROM game_words
        WHERE difficulty IS NULL OR difficulty < 1 OR difficulty > 5
      `;

  const result = db.exec(query);
  if (!result[0] || result[0].values.length === 0) {
    return 0;
  }

  const rows = result[0].values.map(([id, word, length, definition, partOfSpeech]) => ({
    id: Number(id),
    word: String(word || ''),
    length: Number(length || 0),
    definition: String(definition || ''),
    partOfSpeech: String(partOfSpeech || ''),
  }));

  const statement = db.prepare('UPDATE game_words SET difficulty = ? WHERE id = ?');
  for (const row of rows) {
    statement.run([
      rateDifficulty(row),
      row.id,
    ]);
  }
  statement.free();

  return rows.length;
};

const createSchema = (db) => {
  db.exec(schemaSql);

  let addedDifficultyColumn = false;
  if (!hasTableColumn(db, 'game_words', 'difficulty')) {
    db.exec('ALTER TABLE game_words ADD COLUMN difficulty INTEGER NOT NULL DEFAULT 3');
    addedDifficultyColumn = true;
  }

  backfillDifficultyRatings(db, { forceAll: addedDifficultyColumn });
};

const shouldPruneEntry = (word, definition) => (
  definitionMentionsWord(word, definition)
  || containsProfanity(word)
  || containsProfanity(definition)
);

const deletePrunedEntries = (db) => {
  const result = db.exec(`
    SELECT id, word, definition
    FROM game_words
  `);

  if (!result[0] || result[0].values.length === 0) {
    return 0;
  }

  const idsToDelete = result[0].values
    .filter(([, word, definition]) => shouldPruneEntry(word, definition))
    .map(([id]) => Number(id));

  if (idsToDelete.length === 0) {
    return 0;
  }

  const statement = db.prepare('DELETE FROM game_words WHERE id = ?');
  for (const id of idsToDelete) {
    statement.run([id]);
  }
  statement.free();

  return idsToDelete.length;
};

const toUpperAsciiWord = (value) => String(value || '').trim().toUpperCase();

const parseDefinitionEntry = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const separatorIndex = raw.indexOf('\t');
  if (separatorIndex === -1) {
    return {
      partOfSpeech: '',
      definition: raw,
    };
  }

  return {
    partOfSpeech: raw.slice(0, separatorIndex),
    definition: raw.slice(separatorIndex + 1).trim(),
  };
};

const parseFrequency = (entry) => {
  const tags = Array.isArray(entry?.tags) ? entry.tags : [];
  const frequencyTag = tags.find((tag) => typeof tag === 'string' && tag.startsWith('f:'));
  if (!frequencyTag) {
    return Number(entry?.score || 0);
  }

  const parsed = Number(frequencyTag.slice(2));
  return Number.isFinite(parsed) ? parsed : Number(entry?.score || 0);
};

const isAllowedWord = (word, length) => {
  if (!new RegExp(`^[A-Z]{${length}}$`).test(word)) {
    return false;
  }

  return !matcher.hasMatch(word);
};

const fetchDatamuseBatch = async (length, prefix) => {
  const pattern = `${prefix}${'?'.repeat(Math.max(0, length - prefix.length))}`;
  const url = `${datamuseApiUrl}?sp=${pattern}&md=df&max=1000`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Datamuse request failed for ${pattern}: ${response.status}`);
  }

  return response.json();
};

const collectEntries = async (length, targetCount) => {
  const prefixes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const collected = new Map();

  for (const prefix of prefixes) {
    const words = await fetchDatamuseBatch(length, prefix.toLowerCase());

    for (const entry of words) {
      const word = toUpperAsciiWord(entry?.word);
      if (!isAllowedWord(word, length) || collected.has(word)) {
        continue;
      }

      const definitionEntry = Array.isArray(entry?.defs)
        ? entry.defs.map(parseDefinitionEntry).find((item) => item?.definition)
        : null;

      if (!definitionEntry) {
        continue;
      }

      if (shouldPruneEntry(word, definitionEntry.definition)) {
        continue;
      }

      collected.set(word, {
        word,
        length,
        definition: definitionEntry.definition,
        partOfSpeech: definitionEntry.partOfSpeech,
        example: '',
        source: 'datamuse',
        rank: parseFrequency(entry),
      });
    }
  }

  return Array.from(collected.values())
    .sort((left, right) => {
      if (right.rank !== left.rank) {
        return right.rank - left.rank;
      }
      return left.word.localeCompare(right.word);
    })
    .slice(0, targetCount)
    .map((entry, index) => ({
      ...entry,
      difficulty: rateDifficulty(entry),
      sortOrder: index,
    }));
};

const replaceEntriesForGameMode = (db, gameMode, entries) => {
  db.run('DELETE FROM game_words WHERE game_mode = ?', [gameMode]);

  const statement = db.prepare(`
    INSERT INTO game_words (
      game_mode,
      word,
      length,
      definition,
      part_of_speech,
      example,
      difficulty,
      enabled,
      sort_order,
      source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const entry of entries) {
    statement.run([
      gameMode,
      entry.word,
      entry.length,
      entry.definition,
      entry.partOfSpeech || '',
      entry.example || '',
      clampDifficulty(entry.difficulty),
      1,
      entry.sortOrder,
      entry.source || 'datamuse',
    ]);
  }

  statement.free();
};

const populateDatabase = async () => {
  const SQL = await getSql();
  const db = await loadDatabase(SQL);
  createSchema(db);
  await ensurePublicAssets();

  console.log('Fetching daily words from Datamuse...');
  const dailyEntries = await collectEntries(5, DAILY_TARGET_COUNT);

  console.log('Fetching ladder words from Datamuse...');
  const ladderEntries = [];
  for (const [length, targetCount] of Object.entries(LADDER_TARGETS)) {
    const entries = await collectEntries(Number(length), targetCount);
    ladderEntries.push(...entries);
  }

  replaceEntriesForGameMode(db, 'daily', dailyEntries);
  replaceEntriesForGameMode(db, 'ladder', ladderEntries);
  await saveDatabase(db);

  console.log(`Saved ${dailyEntries.length} daily words and ${ladderEntries.length} ladder words to ${databasePath}`);
};

const migrateDatabase = async ({ forceAll = false } = {}) => {
  const SQL = await getSql();
  const db = await loadDatabase(SQL);
  createSchema(db);
  await ensurePublicAssets();

  const updatedRows = backfillDifficultyRatings(db, { forceAll });
  await saveDatabase(db);

  console.log(`Migrated ${databasePath}. Rated ${updatedRows} rows${forceAll ? ' (forced recalculation)' : ''}.`);
};

const pruneDatabase = async () => {
  const SQL = await getSql();
  const db = await loadDatabase(SQL);
  createSchema(db);
  await ensurePublicAssets();

  const deletedRows = deletePrunedEntries(db);
  await saveDatabase(db);

  console.log(`Pruned ${deletedRows} rows from ${databasePath} for revealing definitions or profanity.`);
};

const updateEntry = async ({ action, game, word, length, definition, enabled, partOfSpeech, difficulty }) => {
  if (!game || !word) {
    throw new Error('Both --game and --word are required.');
  }

  const normalizedGame = game === 'daily' ? 'daily' : 'ladder';
  const normalizedWord = toUpperAsciiWord(word);
  const normalizedLength = Number(length || normalizedWord.length);
  if (!Number.isInteger(normalizedLength) || normalizedLength < 1) {
    throw new Error('A valid --length is required.');
  }

  const SQL = await getSql();
  const db = await loadDatabase(SQL);
  createSchema(db);
  await ensurePublicAssets();

  if (action === 'disable') {
    db.run('UPDATE game_words SET enabled = 0 WHERE game_mode = ? AND word = ?', [normalizedGame, normalizedWord]);
    await saveDatabase(db);
    console.log(`Disabled ${normalizedGame}:${normalizedWord}`);
    return;
  }

  const normalizedEnabled = enabled === undefined ? 1 : Number(enabled) ? 1 : 0;
  const normalizedDefinition = String(definition || '').trim();
  if (!normalizedDefinition) {
    throw new Error('A non-empty --definition is required for upsert.');
  }

  if (shouldPruneEntry(normalizedWord, normalizedDefinition)) {
    throw new Error('The word or definition contains profanity or the definition includes the answer word.');
  }

  const normalizedDifficulty = difficulty === undefined
    ? clampDifficulty(rateDifficulty({
      word: normalizedWord,
      length: normalizedLength,
      definition: normalizedDefinition,
      partOfSpeech,
    }))
    : clampDifficulty(difficulty);

  db.run(
    `
      INSERT INTO game_words (
        game_mode,
        word,
        length,
        definition,
        part_of_speech,
        difficulty,
        enabled,
        sort_order,
        source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(game_mode, word) DO UPDATE SET
        length = excluded.length,
        definition = excluded.definition,
        part_of_speech = excluded.part_of_speech,
        difficulty = excluded.difficulty,
        enabled = excluded.enabled,
        source = excluded.source
    `,
    [normalizedGame, normalizedWord, normalizedLength, normalizedDefinition, partOfSpeech || '', normalizedDifficulty, normalizedEnabled, 0, 'manual']
  );

  await saveDatabase(db);
  console.log(`Upserted ${normalizedGame}:${normalizedWord}`);
};

const main = async () => {
  const [command = 'populate', ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (command === 'populate') {
    await populateDatabase();
    return;
  }

  if (command === 'upsert') {
    await updateEntry({
      action: 'upsert',
      game: args.game,
      word: args.word,
      length: args.length,
      definition: args.definition,
      enabled: args.enabled,
      partOfSpeech: args['part-of-speech'],
      difficulty: args.difficulty,
    });
    return;
  }

  if (command === 'migrate') {
    await migrateDatabase({ forceAll: args.force === 'true' });
    return;
  }

  if (command === 'prune') {
    await pruneDatabase();
    return;
  }

  if (command === 'disable') {
    await updateEntry({
      action: 'disable',
      game: args.game,
      word: args.word,
      length: args.length,
    });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});