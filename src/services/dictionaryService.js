const DATAMUSE_API_URL = 'https://api.datamuse.com/words';
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en_GB/';

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
        return /^[A-Z]{5}$/i.test(word);
    }
};

// Cache for storing fetched words
const wordCache = new Map();

// Helper to get a random item from an array
function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export const getRandomWord = async (excludeWords = []) => {
    try {
        // Try to get words from cache first
        let words = wordCache.get('words');

        // If not in cache or running low on words, fetch new ones
        if (!words || words.length < 10) {
            words = await getDictionaryWords();
            wordCache.set('words', words);
        }

        // Filter out excluded words
        let availableWords = words.filter(word => !excludeWords.includes(word));

        // If we're running out of words, fetch new ones
        if (availableWords.length < 5) {
            words = await getDictionaryWords();
            wordCache.set('words', words);
            availableWords = words.filter(word => !excludeWords.includes(word));
        }

        // Try up to N times to find a word with a clue
        const maxTries = availableWords.length;
        for (let i = 0; i < maxTries; i++) {
            const selectedWord = getRandomItem(availableWords);
            const def = await getWordDefinition(selectedWord);
            if (def && def.definitions && def.definitions.length > 0 && def.definitions[0].definition !== 'Definition not available') {
                // Remove the selected word from the cache to avoid repetition
                wordCache.set('words', words.filter(w => w !== selectedWord));
                return selectedWord;
            } else {
                // Remove this word from availableWords and try again
                availableWords = availableWords.filter(w => w !== selectedWord);
            }
        }
        // If no word with a clue is found, fetch a new batch and try again
        words = await getDictionaryWords();
        wordCache.set('words', words);
        return getRandomWord(excludeWords);
    } catch (error) {
        console.error('Error getting random word:', error);
        return 'ERROR';
    }
};

export const getDictionaryWords = async () => {
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
            const queries = [
                `sp=${randomLetter}????`, // exactly 5 letters, starting with our chosen letter
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
                if (!isCommonWord(wordStr) && /^[A-Z]{5}$/i.test(wordObj.word)) {
                    apiWords.add(wordStr);
                    validWordCache.add(wordStr); // Add to cache for future validation
                }
            }
        }

        const allWords = [...apiWords];
        console.log(`Found ${allWords.length} valid words across different starting letters`);

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
        // Add fallback words to cache as well
        const fallbackWords = [
            'HAPPY', 'BRAIN', 'CLOUD', 'DREAM', 'EAGLE',
            'FLAME', 'GHOST', 'HEART', 'IVORY', 'JOKER',
            'LIGHT', 'MUSIC', 'NIGHT', 'OCEAN', 'PEARL',
            'QUICK', 'RIVER', 'STORM', 'TIGER', 'VOICE'
        ];
        fallbackWords.forEach(word => validWordCache.add(word));
        return fallbackWords;
    }
};
