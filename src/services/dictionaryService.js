import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

const DATAMUSE_API_URL = 'https://api.datamuse.com/words';
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en_GB/';

// Create a matcher instance for profanity checking
const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
});

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
        
        // Extract the most relevant information
        const definitions = data[0]?.meanings?.map(meaning => ({
            partOfSpeech: meaning.partOfSpeech,
            definition: meaning.definitions[0].definition,
            example: meaning.definitions[0].example
        })) || [];

        return {
            word: data[0].word,
            phonetic: data[0].phonetic || '',
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
}

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
        return /^[A-Z]{5}$/i.test(word);
    }
};

// Cache for storing fetched words
const wordCache = new Map();

// Helper to get a random item from an array
function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Accepts a random word length between 3 and 10, or a specific word length
export const getRandomWord = async (wordLengthOrExcludeWords = [], maybeExcludeWords) => {
    // Support both getRandomWord(wordLength) and getRandomWord(excludeWords)
    let wordLength = 3;
    let excludeWords = [];
    if (typeof wordLengthOrExcludeWords === 'number') {
        wordLength = wordLengthOrExcludeWords;
        excludeWords = Array.isArray(maybeExcludeWords) ? maybeExcludeWords : [];
    } else if (Array.isArray(wordLengthOrExcludeWords)) {
        // Old usage: getRandomWord(excludeWords)
        wordLength = Math.floor(Math.random() * 8) + 3;
        excludeWords = wordLengthOrExcludeWords;
    }
    try {
        // Try to get words from cache first
        let cacheKey = `words_${wordLength}`;
        let words = wordCache.get(cacheKey);

        // If not in cache or running low on words, fetch new ones
        if (!words || words.length < 10) {
            words = await getDictionaryWords(wordLength);
            wordCache.set(cacheKey, words);
        }

        // Filter out excluded words
        let availableWords = words.filter(word => !excludeWords.includes(word));

        // If we're running out of words, fetch new ones
        if (availableWords.length < 5) {
            words = await getDictionaryWords(wordLength);
            wordCache.set(cacheKey, words);
            availableWords = words.filter(word => !excludeWords.includes(word));
        }

        // Try up to N times to find a word with a clue
        const maxTries = availableWords.length;
        for (let i = 0; i < maxTries; i++) {
            const selectedWord = getRandomItem(availableWords);
            const def = await getWordDefinition(selectedWord);
            if (def && def.definitions && def.definitions.length > 0 && def.definitions[0].definition && def.definitions[0].definition !== 'Definition not available') {
                // Remove the selected word from the cache to avoid repetition
                wordCache.set(cacheKey, words.filter(w => w !== selectedWord));
                return selectedWord;
            } else {
                // Remove this word from availableWords and try again
                availableWords = availableWords.filter(w => w !== selectedWord);
            }
        }
        // If no word found with a clue, just return a random one
        if (availableWords.length > 0) {
            return getRandomItem(availableWords);
        }
        // As a last resort, try again with fallback
        words = await getDictionaryWords(wordLength);
        if (words.length > 0) {
            return getRandomItem(words);
        }
        return null;
    } catch (error) {
        console.error('Error in getRandomWord:', error);
        return null;
    }
};

// Accepts a wordLength parameter (default 5 for backward compatibility)
export const getDictionaryWords = async (wordLength = 5) => {
    try {
        const apiWords = new Set();
        const letterGroups = [
            'AEIOU',  // vowels
            'BCDFG',  // early consonants
            'HJKLM',  // middle consonants
            'NPQRS',  // more middle consonants
            'TVWXYZ'  // end consonants
        ];

        // Fetch words for each letter group
        for (const group of letterGroups) {
            const randomLetter = group[Math.floor(Math.random() * group.length)];
            // Build the pattern for the desired word length
            const pattern = `${randomLetter}${'?'.repeat(wordLength - 1)}`;
            const queries = [
                `sp=${pattern}`,
                'md=f' // include frequency information
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
            // Filter and add valid words to the set (no definition check here)
            for (const wordObj of words) {
                const wordStr = wordObj.word.toUpperCase();
                if (!isCommonWord(wordStr) && new RegExp(`^[A-Z]{${wordLength}}$`, 'i').test(wordObj.word)) {
                    apiWords.add(wordStr);
                    validWordCache.add(wordStr); // Add to cache for future validation
                }
            }
        }

        // Use matcher.hasMatch to filter out profane words
        const allWords = [...apiWords].filter(word => !matcher.hasMatch(word));

        if (allWords.length === 0) {
            throw new Error('No valid words found');
        }

        // Shuffle the array for extra randomness
        for (let i = allWords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allWords[i], allWords[j]] = [allWords[j], allWords[i]];
        }

        return allWords;
    } catch (error) {
        console.error('Error in getDictionaryWords:', error);
        // Expanded fallback words for each length (3-10)
        const fallbackWords = [
            // 3-letter
            'SUN', 'DOG', 'CAT', 'CAR', 'BEE', 'SKY', 'MAP', 'PEN', 'BOX', 'HAT',
            // 4-letter
            'TREE', 'MOON', 'FISH', 'BIRD', 'LION', 'WOLF', 'FROG', 'SHIP', 'STAR', 'FIRE',
            // 5-letter
            'HAPPY', 'BRAIN', 'CLOUD', 'DREAM', 'EAGLE', 'PLANT', 'SNAKE', 'WATER', 'EARTH', 'MOUSE',
            // 6-letter
            'FLAMES', 'GHOSTS', 'HEARTS', 'IVORYS', 'JOKERS', 'PLANET', 'ORANGE', 'PURPLE', 'SILVER', 'BUTTON',
            // 7-letter
            'MUSICAL', 'NIGHTLY', 'OCEANIC', 'PEARLED', 'QUICKLY', 'CAPTURE', 'FANTASY', 'GRAVITY', 'HORIZON', 'JOURNEY',
            // 8-letter
            'RIVERTON', 'STORMING', 'TIGERING', 'VOICINGS', 'ABSOLUTE', 'BASEBALL', 'CAMPFIRE', 'DARKNESS', 'ECLIPSES', 'FEATHERS',
            // 9-letter
            'CELEBRATE', 'EXPLORING', 'HAPPINESS', 'KNOWLEDGE', 'MOTIVATOR', 'ADVENTURES', 'BLUEBERRY', 'CROSSWORD', 'DISCOVERY', 'EDUCATION',
            // 10-letter
            'CELEBRATION', 'EXPERIENCE', 'HAPPINESS', 'KNOWLEDGE', 'MOTIVATION', 'ADVENTURERS', 'BLACKBERRYS', 'COMPLEXITY', 'DEFINITION', 'EVERLASTING'
        ];
        fallbackWords.forEach(word => validWordCache.add(word));
        // Only return fallback words of the requested length
        return fallbackWords.filter(w => w.length === wordLength);
    }
};
