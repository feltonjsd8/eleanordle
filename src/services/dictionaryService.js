import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import DAILY_WORDS from './wordList';
import { getEnabledWordEntries } from './gameDatabase';

const DATAMUSE_API_URL = 'https://api.datamuse.com/words';
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en_GB/';

const FALLBACK_WORDS_BY_LENGTH = {
    4: [
        'ARCH', 'BARK', 'COVE', 'DAWN', 'ECHO',
        'FERN', 'GLOW', 'HAZE', 'ISLE', 'JOLT',
        'KITE', 'LAMB', 'MOSS', 'NOVA', 'OPAL',
        'PINE', 'QUAY', 'ROSE', 'SURF', 'TIDE'
    ],
    5: [
        'HAPPY', 'BRAIN', 'CLOUD', 'DREAM', 'EAGLE',
        'FLAME', 'GHOST', 'HEART', 'IVORY', 'JOKER',
        'LIGHT', 'MUSIC', 'NIGHT', 'OCEAN', 'PEARL',
        'QUICK', 'RIVER', 'STORM', 'TIGER', 'VOICE'
    ],
    6: [
        'ANCHOR', 'BREEZE', 'CANDLE', 'DRAGON', 'EMBLEM',
        'FALCON', 'GALAXY', 'HARBOR', 'ICICLE', 'JUNGLE',
        'KETTLE', 'LAGOON', 'MEADOW', 'NECTAR', 'ORCHID',
        'PLANET', 'QUARRY', 'RIPPLE', 'SPRING', 'THRONE'
    ]
};

const DAILY_LADDER_FALLBACK_WORDS = {
    4: ['MOSS', 'FERN', 'TIDE', 'ARCH'],
    5: ['GRAPE', 'APPLE', 'RIVER', 'STORM'],
    6: ['PLANET', 'SPRING', 'MEADOW', 'THRONE'],
};

const DEFAULT_DEFINITION = 'Definition not available';

const getWordPattern = (length, firstLetter = '?') => {
    const suffixLength = Math.max(0, length - 1);
    return `${firstLetter}${'?'.repeat(suffixLength)}`;
};

const getWordRegex = (length) => new RegExp(`^[A-Z]{${length}}$`, 'i');
const getCacheKey = (length) => `words:${length}`;
const getEntryCacheKey = (gameMode = '*', length = '*') => `${gameMode}:${length}`;

const getSourceWordFromUrl = (url) => {
    if (typeof url !== 'string' || url.length === 0) return '';

    const normalizedUrl = url.split('?')[0].replace(/\/+$/, '');
    const lastSegment = normalizedUrl.slice(normalizedUrl.lastIndexOf('/') + 1);

    try {
        return decodeURIComponent(lastSegment).toLowerCase();
    } catch {
        return lastSegment.toLowerCase();
    }
};

const isCanonicalEntry = (entry, requestedWord) => {
    if (entry?.word?.toLowerCase() !== requestedWord) {
        return false;
    }

    const sourceWords = (entry?.sourceUrls || [])
        .map(getSourceWordFromUrl)
        .filter(Boolean);

    if (sourceWords.length === 0) {
        return true;
    }

    return sourceWords.every((sourceWord) => sourceWord === requestedWord);
};

const extractDefinitions = (entries) => {
    const seen = new Set();

    return entries.flatMap((entry) =>
        (entry?.meanings || []).flatMap((meaning) =>
            (meaning?.definitions || []).flatMap((definition) => {
                const trimmedDefinition = definition?.definition?.trim();
                if (!trimmedDefinition) {
                    return [];
                }

                const item = {
                    partOfSpeech: meaning?.partOfSpeech || '',
                    definition: trimmedDefinition,
                    example: definition?.example || ''
                };
                const dedupeKey = `${item.partOfSpeech}:${item.definition}:${item.example}`;

                if (seen.has(dedupeKey)) {
                    return [];
                }

                seen.add(dedupeKey);
                return [item];
            })
        )
    );
};

const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
});

const createSeededRandom = (seed) => {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const hashToUint32 = (str) => {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const validWordCache = new Set();
const wordCache = new Map();
const entryCache = new Map();

const isCommonWord = (word) => {
    const commonWords = new Set([
        'WORDS', 'THING', 'STUFF', 'ITEMS', 'TYPES',
        'ABOUT', 'OTHER', 'THESE', 'THOSE', 'THEIR',
        'THERE', 'WHERE', 'WHEN', 'WHAT', 'THIS',
        'WHICH', 'EVERY', 'MANY', 'SOME', 'MORE',
        'MOST', 'THAN', 'WITH', 'THAT', 'HAVE'
    ]);
    return commonWords.has(word);
};

const getFallbackEntry = (word, gameMode = 'daily', sortOrder = 0) => ({
    gameMode,
    word,
    length: word.length,
    definition: DEFAULT_DEFINITION,
    partOfSpeech: '',
    example: '',
    sortOrder,
    source: 'fallback',
});

const getDailyFallbackEntries = () => DAILY_WORDS.map((word, index) => getFallbackEntry(word, 'daily', index));

const getLadderFallbackEntries = (length) => {
    const candidates = DAILY_LADDER_FALLBACK_WORDS[length] || FALLBACK_WORDS_BY_LENGTH[length] || [];
    return candidates.map((word, index) => getFallbackEntry(word, 'ladder', index));
};

const dedupeEntriesByWord = (entries) => {
    const seen = new Set();

    return entries.filter((entry) => {
        const word = String(entry?.word || '').toUpperCase();
        if (!word || seen.has(word)) {
            return false;
        }

        seen.add(word);
        return true;
    });
};

const getDatabaseEntries = async () => {
    if (entryCache.has('all')) {
        return entryCache.get('all');
    }

    const rows = await getEnabledWordEntries();
    const normalizedRows = Array.isArray(rows) && rows.length > 0 ? rows : null;
    entryCache.set('all', normalizedRows);
    return normalizedRows;
};

const getEntries = async ({ gameMode = null, length = null } = {}) => {
    const cacheKey = getEntryCacheKey(gameMode || '*', length || '*');
    if (entryCache.has(cacheKey)) {
        return entryCache.get(cacheKey);
    }

    const rows = await getDatabaseEntries();
    if (!rows) {
        entryCache.set(cacheKey, null);
        return null;
    }

    const filtered = rows.filter((entry) => {
        if (gameMode && entry.gameMode !== gameMode) {
            return false;
        }
        if (length && entry.length !== length) {
            return false;
        }
        return true;
    });

    entryCache.set(cacheKey, filtered);
    return filtered;
};

const getWordsFromEntries = (entries) => dedupeEntriesByWord(entries).map((entry) => entry.word);

const getEntryForWord = async (word) => {
    const normalizedWord = String(word || '').toUpperCase();
    if (!normalizedWord) {
        return null;
    }

    const rows = await getDatabaseEntries();
    if (!rows) {
        return null;
    }

    return rows.find((entry) => entry.word === normalizedWord) || null;
};

const shuffleWords = (words, seed = null) => {
    const list = [...words];
    const rng = seed !== null ? createSeededRandom(seed) : Math.random;
    const getRandom = typeof rng === 'function' && seed !== null ? rng : () => Math.random();

    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(getRandom() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }

    return list;
};

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getDatabaseWordsForLength = async (length) => {
    const entries = await getEntries({ length });
    if (!entries || entries.length === 0) {
        return null;
    }

    return getWordsFromEntries(entries.filter((entry) => entry.length === length));
};

export const getDailyWordRecord = async (dateKey) => {
    const entries = await getEntries({ gameMode: 'daily', length: 5 });
    if (entries && entries.length > 0) {
        const index = hashToUint32(dateKey) % entries.length;
        return entries[index];
    }

    const index = hashToUint32(dateKey) % DAILY_WORDS.length;
    return getDailyFallbackEntries()[index];
};

export const getDailyLadderWords = async (dateKey) => {
    const dailyWord = (await getDailyWordRecord(dateKey)).word;

    return Promise.all([4, 5, 6].map(async (length) => {
        const entries = await getEntries({ gameMode: 'ladder', length });
        if (entries && entries.length > 0) {
            const index = hashToUint32(`${dateKey}:daily-ladder:${length}`) % entries.length;
            const selected = entries[index].word;

            if (length !== 5 || selected !== dailyWord) {
                return selected;
            }

            return entries[(index + 1) % entries.length].word;
        }

        const fallbackEntries = getLadderFallbackEntries(length);
        const index = hashToUint32(`${dateKey}:daily-ladder:${length}`) % fallbackEntries.length;
        const selected = fallbackEntries[index]?.word || FALLBACK_WORDS_BY_LENGTH[length]?.[0] || 'ERROR';

        if (length !== 5 || selected !== dailyWord) {
            return selected;
        }

        return fallbackEntries[(index + 1) % fallbackEntries.length]?.word || selected;
    }));
};

export const getWordDefinition = async (word) => {
    const normalizedWord = String(word || '').toUpperCase();

    try {
        const databaseEntry = await getEntryForWord(normalizedWord);
        if (databaseEntry?.definition) {
            return {
                word: normalizedWord,
                phonetic: '',
                definitions: [{
                    partOfSpeech: databaseEntry.partOfSpeech || '',
                    definition: databaseEntry.definition,
                    example: databaseEntry.example || ''
                }]
            };
        }

        const response = await fetch(`${DICTIONARY_API_URL}${normalizedWord.toLowerCase()}`);
        if (!response.ok) {
            throw new Error('Definition not found');
        }
        const data = await response.json();

        const requestedWord = normalizedWord.toLowerCase();
        const exactEntries = Array.isArray(data)
            ? data.filter((entry) => entry?.word?.toLowerCase() === requestedWord)
            : [];
        const canonicalEntries = exactEntries.filter((entry) => isCanonicalEntry(entry, requestedWord));
        const selectedEntries = canonicalEntries.length > 0 ? canonicalEntries : exactEntries;
        const definitions = extractDefinitions(selectedEntries);

        if (selectedEntries.length === 0 || definitions.length === 0) {
            throw new Error('Definition not found');
        }

        const preferredEntry = selectedEntries.find((entry) => entry?.phonetic) || selectedEntries[0];

        return {
            word: preferredEntry.word,
            phonetic: preferredEntry.phonetic || '',
            definitions
        };
    } catch (error) {
        console.error('Error fetching definition:', error);
        return {
            word: normalizedWord,
            phonetic: '',
            definitions: [{
                partOfSpeech: '',
                definition: DEFAULT_DEFINITION,
                example: ''
            }]
        };
    }
};

export const isValidWord = async (word) => {
    const normalizedWord = String(word || '').toUpperCase();

    if (validWordCache.has(normalizedWord)) {
        return true;
    }

    const databaseEntry = await getEntryForWord(normalizedWord);
    if (databaseEntry) {
        validWordCache.add(normalizedWord);
        return true;
    }

    try {
        const response = await fetch(`${DATAMUSE_API_URL}?sp=${normalizedWord.toLowerCase()}&md=f&max=1`);

        if (!response.ok) {
            return false;
        }

        const words = await response.json();
        const isValid = words.length > 0 && words[0].word.toLowerCase() === normalizedWord.toLowerCase();

        if (isValid) {
            validWordCache.add(normalizedWord);
        }

        return isValid;
    } catch (error) {
        console.error('Error checking word validity:', error);
        return /^[A-Z]{4,6}$/i.test(normalizedWord);
    }
};

export const getRandomWord = async (excludeWords = [], length = 5) => {
    try {
        const cacheKey = getCacheKey(length);
        let words = wordCache.get(cacheKey);

        if (!words || words.length < 10) {
            words = await getDictionaryWords(null, length);
            wordCache.set(cacheKey, words);
        }

        let availableWords = words.filter((word) => !excludeWords.includes(word));

        if (availableWords.length < 5) {
            words = await getDictionaryWords(null, length);
            wordCache.set(cacheKey, words);
            availableWords = words.filter((word) => !excludeWords.includes(word));
        }

        const databaseWords = await getDatabaseWordsForLength(length);
        if (databaseWords && databaseWords.length > 0) {
            const sourceWords = availableWords.length > 0 ? availableWords : databaseWords.filter((word) => !excludeWords.includes(word));
            const selectedWord = getRandomItem(sourceWords);
            wordCache.set(cacheKey, words.filter((word) => word !== selectedWord));
            return selectedWord;
        }

        const maxTries = availableWords.length;
        for (let i = 0; i < maxTries; i += 1) {
            const selectedWord = getRandomItem(availableWords);
            const def = await getWordDefinition(selectedWord);
            if (def?.definitions?.[0]?.definition !== DEFAULT_DEFINITION) {
                wordCache.set(cacheKey, words.filter((word) => word !== selectedWord));
                return selectedWord;
            }

            availableWords = availableWords.filter((word) => word !== selectedWord);
        }

        words = await getDictionaryWords(null, length);
        wordCache.set(cacheKey, words);
        return getRandomWord(excludeWords, length);
    } catch (error) {
        console.error('Error getting random word:', error);
        return 'ERROR';
    }
};

export const getDictionaryWords = async (seed = null, length = 5) => {
    const databaseWords = await getDatabaseWordsForLength(length);
    if (databaseWords && databaseWords.length > 0) {
        databaseWords.forEach((word) => validWordCache.add(word));
        return shuffleWords(databaseWords, seed);
    }

    try {
        const apiWords = new Set();
        const wordRegex = getWordRegex(length);
        const letterGroups = [
            'AEIOU',
            'BCDFG',
            'HJKLM',
            'NPQRS',
            'TVWXYZ'
        ];

        const rng = seed !== null ? createSeededRandom(seed) : Math.random;
        const getRandom = typeof rng === 'function' && seed !== null ? rng : () => Math.random();

        for (const group of letterGroups) {
            const randomLetter = group[Math.floor(getRandom() * group.length)];
            const queries = [
                `sp=${getWordPattern(length, randomLetter)}`,
                'md=f'
            ];

            const response = await fetch(`${DATAMUSE_API_URL}?${queries.join('&')}&max=50`);

            if (!response.ok) {
                console.warn(`Failed to fetch words for letter ${randomLetter}`);
                continue;
            }

            if (response.status === 202) {
                console.warn(`Datamuse API returned 202 Accepted for letter ${randomLetter}. Skipping.`);
                continue;
            }

            const words = await response.json();

            for (const wordObj of words) {
                const wordStr = wordObj.word.toUpperCase();
                if (!isCommonWord(wordStr) && wordRegex.test(wordObj.word)) {
                    apiWords.add(wordStr);
                    validWordCache.add(wordStr);
                }
            }
        }

        const allWords = [...apiWords].filter((word) => !matcher.hasMatch(word));

        if (allWords.length === 0) {
            throw new Error('No valid words found');
        }

        return shuffleWords(allWords, seed);
    } catch (error) {
        console.error('Error in getDictionaryWords:', error);
        const fallbackWords = FALLBACK_WORDS_BY_LENGTH[length] || FALLBACK_WORDS_BY_LENGTH[5];
        fallbackWords.forEach((word) => validWordCache.add(word));
        return shuffleWords(fallbackWords, seed);
    }
};
