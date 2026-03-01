import { getWordFinderSuggestions } from '../services/suggestionService';

describe('suggestionService.getWordFinderSuggestions', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('filters out the target word', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ word: 'crane' }, { word: 'berry' }],
    });

    const correct = Array(5).fill(null);
    const present = new Set();
    const absent = new Set();
    const targetWord = 'BERRY';

    const suggestions = await getWordFinderSuggestions(correct, present, absent, targetWord);
    expect(suggestions).toContain('CRANE');
    expect(suggestions).not.toContain('BERRY');
  });

  it('filters out words placing a present letter in the same wrong position', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ word: 'react' }, { word: 'crane' }, { word: 'trace' }],
    });

    const correct = Array(5).fill(null);
    const present = new Set(['R']);
    const absent = new Set();
    const targetWord = 'TOWER';
    const wrongPosition = new Set(['R-0']);

    const suggestions = await getWordFinderSuggestions(correct, present, absent, targetWord, wrongPosition);

    expect(suggestions).not.toContain('REACT');
    expect(suggestions).toContain('CRANE');
    expect(suggestions).toContain('TRACE');
  });
});
