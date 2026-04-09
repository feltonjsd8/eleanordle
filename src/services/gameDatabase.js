import initSqlJs from 'sql.js';

const DATABASE_FILE = 'game-content.sqlite';
const SQLITE_MAGIC = 'SQLite format 3';
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];

let sqlPromise = null;
let databasePromise = null;

const normalizeBasePath = () => {
  const basePath = process.env.PUBLIC_URL || '';
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
};

const canLoadDatabase = () => typeof window !== 'undefined' && typeof fetch === 'function';

const getCandidateAssetUrls = (fileName) => {
  const candidates = new Set();
  const basePath = normalizeBasePath();
  const currentPath = window.location.pathname.replace(/\/[^/]*$/, '');

  if (basePath) {
    candidates.add(`${basePath}/${fileName}`);
  }

  candidates.add(`/${fileName}`);

  if (currentPath) {
    candidates.add(`${currentPath}/${fileName}`.replace(/\/+/g, '/'));
  }

  return [...candidates];
};

const startsWithMagic = (bytes, magicBytes) => magicBytes.every((value, index) => bytes[index] === value);

const isSqliteBinary = (bytes) => {
  const header = new TextDecoder('ascii').decode(bytes.slice(0, SQLITE_MAGIC.length));
  return header === SQLITE_MAGIC;
};

const fetchValidatedAsset = async (fileName, validator) => {
  const errors = [];

  for (const assetUrl of getCandidateAssetUrls(fileName)) {
    try {
      const response = await fetch(assetUrl, { cache: 'no-cache' });
      if (!response.ok) {
        errors.push(`${assetUrl} (${response.status})`);
        continue;
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!validator(bytes)) {
        errors.push(`${assetUrl} (unexpected content)`);
        continue;
      }

      return bytes;
    } catch (error) {
      errors.push(`${assetUrl} (${error.message})`);
    }
  }

  throw new Error(`Unable to load ${fileName}. Tried: ${errors.join(', ')}`);
};

const getSqlJs = async () => {
  if (!canLoadDatabase()) {
    return null;
  }

  if (!sqlPromise) {
    sqlPromise = (async () => {
      const wasmBinary = await fetchValidatedAsset('sql-wasm.wasm', (bytes) => startsWithMagic(bytes, WASM_MAGIC));
      return initSqlJs({ wasmBinary });
    })().catch((error) => {
      console.error('Error loading sql.js:', error);
      sqlPromise = null;
      return null;
    });
  }

  return sqlPromise;
};

export const loadGameDatabase = async () => {
  if (!canLoadDatabase()) {
    return null;
  }

  if (!databasePromise) {
    databasePromise = (async () => {
      const SQL = await getSqlJs();
      if (!SQL) {
        return null;
      }

      const databaseBytes = await fetchValidatedAsset(DATABASE_FILE, isSqliteBinary);
      return new SQL.Database(databaseBytes);
    })().catch((error) => {
      console.error('Error loading game database:', error);
      databasePromise = null;
      return null;
    });
  }

  return databasePromise;
};

export const getEnabledWordEntries = async () => {
  const db = await loadGameDatabase();
  if (!db) {
    return null;
  }

  const statement = db.prepare(`
    SELECT
      game_mode AS gameMode,
      word,
      length,
      definition,
      COALESCE(part_of_speech, '') AS partOfSpeech,
      COALESCE(example, '') AS example,
      COALESCE(difficulty, 3) AS difficulty,
      enabled,
      sort_order AS sortOrder,
      source
    FROM game_words
    WHERE enabled = 1
    ORDER BY game_mode ASC, length ASC, sort_order ASC, word ASC
  `);

  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();

  return rows.map((row) => ({
    gameMode: row.gameMode,
    word: String(row.word || '').toUpperCase(),
    length: Number(row.length || 0),
    definition: String(row.definition || ''),
    partOfSpeech: String(row.partOfSpeech || ''),
    example: String(row.example || ''),
    difficulty: Number(row.difficulty || 3),
    enabled: Number(row.enabled || 0),
    sortOrder: Number(row.sortOrder || 0),
    source: String(row.source || ''),
  }));
};


