import { getDictionaryWords, isValidWord } from '../services/dictionaryService';

describe('Dictionary Service - Countries', () => {
    it('should return valid 5-letter country names', async () => {
        const words = await getDictionaryWords('countries');
        console.log('Found countries:', words);
        console.log('Total number of countries:', words.length);
        
        // Verify we got some results
        expect(words.length).toBeGreaterThan(0);
        
        // Verify all words are 5 letters
        words.forEach(word => {
            expect(word.length).toBe(5);
        });
    });
});

describe('Dictionary Service - Profanity Filter', () => {
    it('should filter out inappropriate words', async () => {
        const words = await getDictionaryWords();
        expect(words).not.toContain('BITCH');
        expect(words).not.toContain('JIHAD');
        expect(words).not.toContain('NIGGA');
    });
});

describe('Dictionary Service - UK English', () => {
    it('should return true for a valid UK spelling', async () => {
        const isValid = await isValidWord('COLOUR');
        expect(isValid).toBe(true);
    });
});""
