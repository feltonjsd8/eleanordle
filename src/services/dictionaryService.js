import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

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

const getWordPattern = (length, firstLetter = '?') => {
    const suffixLength = Math.max(0, length - 1);
    return `${firstLetter}${'?'.repeat(suffixLength)}`;
};

const getWordRegex = (length) => new RegExp(`^[A-Z]{${length}}$`, 'i');

const getCacheKey = (length) => `words:${length}`;

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

// Create a matcher instance for profanity checking
const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
});

// Seeded random number generator (Mulberry32)
const createSeededRandom = (seed) => {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// Cache for valid words to reduce API calls
const validWordCache = new Set();

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

export const getWordDefinition = async (word) => {
    try {
        const response = await fetch(`${DICTIONARY_API_URL}${word.toLowerCase()}`);
        if (!response.ok) {
            throw new Error('Definition not found');
        }
        const data = await response.json();

        const requestedWord = word.toLowerCase();
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
            word: word,
            phonetic: '',
            definitions: [{
                partOfSpeech: '',
                definition: 'Definition not available',
                example: ''
            }]
        };
    }
};

export const isValidWord = async (word) => {
    // First check our cache
    if (validWordCache.has(word.toUpperCase())) {
        return true;
    }

    try {
        // Use sp (spelling) parameter for exact match
        const response = await fetch(`${DATAMUSE_API_URL}?sp=${word.toLowerCase()}&md=f&max=1`);
        
        if (!response.ok) {
            return false;
        }

        const words = await response.json();
        const isValid = words.length > 0 && words[0].word.toLowerCase() === word.toLowerCase();
        
        // If it's valid, add to cache for future checks
        if (isValid) {
            validWordCache.add(word.toUpperCase());
        }
        
        return isValid;
    } catch (error) {
        console.error('Error checking word validity:', error);
        // Fall back to basic validation in case of API error
        return /^[A-Z]{4,6}$/i.test(word);
    }
};

// Cache for storing fetched words
const wordCache = new Map();

// Helper to get a random item from an array
function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export const getRandomWord = async (excludeWords = [], length = 5) => {
    try {
        // Try to get words from cache first
        const cacheKey = getCacheKey(length);
        let words = wordCache.get(cacheKey);

        // If not in cache or running low on words, fetch new ones
        if (!words || words.length < 10) {
            words = await getDictionaryWords(null, length);
            wordCache.set(cacheKey, words);
        }

        // Filter out excluded words
        let availableWords = words.filter(word => !excludeWords.includes(word));

        // If we're running out of words, fetch new ones
        if (availableWords.length < 5) {
            words = await getDictionaryWords(null, length);
            wordCache.set(cacheKey, words);
            availableWords = words.filter(word => !excludeWords.includes(word));
        }

        // Try up to N times to find a word with a clue
        const maxTries = availableWords.length;
        for (let i = 0; i < maxTries; i++) {
            const selectedWord = getRandomItem(availableWords);
            const def = await getWordDefinition(selectedWord);
            if (def && def.definitions && def.definitions.length > 0 && def.definitions[0].definition !== 'Definition not available') {
                // Remove the selected word from the cache to avoid repetition
                wordCache.set(cacheKey, words.filter(w => w !== selectedWord));
                return selectedWord;
            } else {
                // Remove this word from availableWords and try again
                availableWords = availableWords.filter(w => w !== selectedWord);
            }
        }
        // If no word with a clue is found, fetch a new batch and try again
        words = await getDictionaryWords(null, length);
        wordCache.set(cacheKey, words);
        return getRandomWord(excludeWords, length);
    } catch (error) {
        console.error('Error getting random word:', error);
        return 'ERROR';
    }
};

export const getDictionaryWords = async (seed = null, length = 5) => {
    try {
        const apiWords = new Set();
        const wordRegex = getWordRegex(length);
        const letterGroups = [
            'AEIOU',  // vowels
            'BCDFG',  // early consonants
            'HJKLM',  // middle consonants
            'NPQRS',  // more middle consonants
            'TVWXYZ'  // end consonants
        ];

        // Use seeded random if a seed is provided, otherwise use Math.random
        const rng = seed !== null ? createSeededRandom(seed) : Math.random;
        const getRandom = typeof rng === 'function' && seed !== null ? rng : () => Math.random();

        // Fetch words for each letter group
        for (const group of letterGroups) {
            const randomLetter = group[Math.floor(getRandom() * group.length)];
            const queries = [
                `sp=${getWordPattern(length, randomLetter)}`,
                'md=f' // include frequency information
            ];

            const response = await fetch(`${DATAMUSE_API_URL}?${queries.join('&')}&max=50`);
                    
            if (!response.ok) {
                console.warn(`Failed to fetch words for letter ${randomLetter}`);
                continue;
            }

            // The Datamuse API can return 202 Accepted if it's under load.
            // This response has no body, so we should skip it and continue the loop.
            if (response.status === 202) {
                console.warn(`Datamuse API returned 202 Accepted for letter ${randomLetter}. Skipping.`);
                continue;
            }

            const words = await response.json();
            console.log(`Received ${words.length} words starting with ${randomLetter}`);
            
            // Filter and add valid words to the set (no definition check here)
            for (const wordObj of words) {
                const wordStr = wordObj.word.toUpperCase();
                if (!isCommonWord(wordStr) && wordRegex.test(wordObj.word)) {
                    apiWords.add(wordStr);
                    validWordCache.add(wordStr); // Add to cache for future validation
                }
            }
        }

        // Use matcher.hasMatch to filter out profane words
        const allWords = [...apiWords].filter(word => !matcher.hasMatch(word));
        console.log(`Found ${allWords.length} valid words across different starting letters`);

        if (allWords.length === 0) {
            throw new Error('No valid words found');
        }

        // Shuffle the array using seeded random if available
        for (let i = allWords.length - 1; i > 0; i--) {
            const j = Math.floor(getRandom() * (i + 1));
            [allWords[i], allWords[j]] = [allWords[j], allWords[i]];
        }

        return allWords;
    } catch (error) {
        console.error('Error in getDictionaryWords:', error);
        const fallbackWords = FALLBACK_WORDS_BY_LENGTH[length] || FALLBACK_WORDS_BY_LENGTH[5];
        fallbackWords.forEach(word => validWordCache.add(word));
        return fallbackWords;
    }
};
