import { getDictionaryWords, getWordDefinition, isValidWord } from '../services/dictionaryService';

describe('dictionaryService', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Reset any previous fetch mocks
    delete global.fetch;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
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

  it('getDictionaryWords returns fallback words for requested lengths', async () => {
    delete global.fetch;

    const fourLetterWords = await getDictionaryWords(null, 4);
    const sixLetterWords = await getDictionaryWords(null, 6);

    fourLetterWords.forEach((w) => expect(w).toMatch(/^[A-Z]{4}$/));
    sixLetterWords.forEach((w) => expect(w).toMatch(/^[A-Z]{6}$/));
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

  it('getWordDefinition prefers canonical entries when the API includes cross-linked meanings', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          {
            word: 'jawn',
            phonetic: '/d\u0361\u0292\u0254\u02d0n/',
            sourceUrls: [
              'https://en.wiktionary.org/wiki/jawn',
              'https://en.wiktionary.org/wiki/yawn',
            ],
            meanings: [
              {
                partOfSpeech: 'verb',
                definitions: [
                  {
                    definition: 'To open the mouth widely and take a long, rather deep breath.',
                    example: 'The class made me yawn.',
                  },
                ],
              },
            ],
          },
          {
            word: 'jawn',
            phonetic: '/d\u0361\u0292\u0254\u02d0n/',
            sourceUrls: ['https://en.wiktionary.org/wiki/jawn'],
            meanings: [
              {
                partOfSpeech: 'noun',
                definitions: [
                  {
                    definition: '(chiefly Philadelphia) Something; any object, place or thing.',
                    example: 'Pass me that jawn.',
                  },
                ],
              },
            ],
          },
        ]),
      })
    );

    const definition = await getWordDefinition('JAWN');

    expect(definition.word).toBe('jawn');
    expect(definition.definitions).toEqual([
      {
        partOfSpeech: 'noun',
        definition: '(chiefly Philadelphia) Something; any object, place or thing.',
        example: 'Pass me that jawn.',
      },
    ]);
  });
});
