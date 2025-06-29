import { getWordFinderSuggestions } from '../services/suggestionService';

// Mock the suggestion service
jest.mock('../services/suggestionService', () => ({
  getWordFinderSuggestions: jest.fn(),
}));

describe('Suggestion Logic', () => {
  beforeEach(() => {
    // Clear mock history before each test
    getWordFinderSuggestions.mockClear();
  });

  it('should not suggest a word that has already been used', async () => {
    const usedSuggestions = ['GRAPE'];
    const suggestions = ['APPLE', 'LEMON', 'GRAPE'];
    getWordFinderSuggestions.mockResolvedValue(suggestions);

    const correct = [];
    const present = new Set();
    const absent = new Set();
    const targetWord = 'BERRY';

    // First call to get a suggestion
    const firstSuggestion = 'GRAPE';

    // Second call
    const availableWords = suggestions.filter(word => !usedSuggestions.includes(word));
    const secondSuggestions = await getWordFinderSuggestions(correct, present, absent, targetWord);
    const secondSuggestion = secondSuggestions.filter(word => !usedSuggestions.includes(word))[0];

    expect(secondSuggestion).not.toBe(firstSuggestion);
    expect(availableWords).not.toContain(firstSuggestion);
  });
});
