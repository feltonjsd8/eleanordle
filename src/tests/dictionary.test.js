import { getDictionaryWords, isValidWord } from '../services/dictionaryService';

describe('dictionaryService', () => {
  beforeEach(() => {
    // Reset any previous fetch mocks
    delete global.fetch;
  });

  it('getDictionaryWords returns uppercase 5-letter words and filters profanity (fallback path)', async () => {
    // Force the fallback path by making fetch unavailable
    delete global.fetch;

    const words = await getDictionaryWords();

    expect(Array.isArray(words)).toBe(true);
    expect(words.length).toBeGreaterThan(0);

    words.forEach((w) => {
      expect(w).toMatch(/^[A-Z]{5}$/);
    });

    // A few known bad words should not appear
    expect(words).not.toContain('BITCH');
    expect(words).not.toContain('JIHAD');
    expect(words).not.toContain('NIGGA');
  });

  it('isValidWord returns true when Datamuse returns an exact match', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ word: 'fibre' }]),
      })
    );

    const valid = await isValidWord('FIBRE');
    expect(valid).toBe(true);
  });

  it('isValidWord returns false when Datamuse returns no exact match', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    );

    const valid = await isValidWord('CIGAR');
    expect(valid).toBe(false);
  });
});
