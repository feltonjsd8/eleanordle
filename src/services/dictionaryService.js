const DATAMUSE_API_URL = 'https://api.datamuse.com/words';
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

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

export const getDictionaryWords = async () => {
    try {
        const apiWords = new Set();
        // Get words starting with different letters for better distribution
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

            const words = await response.json();
            console.log(`Received ${words.length} words starting with ${randomLetter}`);
            
            // Filter and add valid words to the set
            words
                .filter(word => {
                    const wordStr = word.word.toUpperCase();
                    return !isCommonWord(wordStr) && /^[A-Z]{5}$/i.test(word.word);
                })
                .forEach(word => apiWords.add(word.word.toUpperCase()));
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
        // Return some default words as fallback with varied starting letters
        return [
            'HAPPY', 'BRAIN', 'CLOUD', 'DREAM', 'EAGLE',
            'FLAME', 'GHOST', 'HEART', 'IVORY', 'JOKER',
            'LIGHT', 'MUSIC', 'NIGHT', 'OCEAN', 'PEARL',
            'QUICK', 'RIVER', 'STORM', 'TIGER', 'VOICE'
        ];
    }
};

// Cache for storing fetched words
const wordCache = new Map();

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
        const availableWords = words.filter(word => !excludeWords.includes(word));

        // If we're running out of words, fetch new ones
        if (availableWords.length < 5) {
            words = await getDictionaryWords();
            wordCache.set('words', words);
            return getRandomWord(excludeWords);
        }

        // Get a random word from the available words
        const randomIndex = Math.floor(Math.random() * availableWords.length);
        const selectedWord = availableWords[randomIndex];

        // Remove the selected word from the cache to avoid repetition
        wordCache.set('words', words.filter(w => w !== selectedWord));

        return selectedWord;
    } catch (error) {
        console.error('Error getting random word:', error);
        return 'ERROR';
    }
};
