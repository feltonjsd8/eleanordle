// Returns up to 10 suggested words matching the user's current guess and known letter states
import { getDictionaryWords } from './dictionaryService';

/**
 * Suggests words matching the user's current guess and known letter states, using Datamuse API for the correct word length.
 * @param {string} currentGuess - The user's current guess (may be partial).
 * @param {object} letterStates - { A: 'correct'|'wrong-position'|'incorrect' }
 * @param {Array} evaluations - Array of evaluations for each guess row
 * @param {number} wordLength - Length of the answer word
 * @returns {Promise<string[]>} Up to 10 suggested words
 */
export async function getSuggestions(currentGuess, letterStates, evaluations, wordLength = 5) {
  // Build constraints from evaluations
  const correct = Array(wordLength).fill(null);
  const present = new Set();
  const absent = new Set();

  evaluations.forEach((evalRow, rowIdx) => {
    if (!evalRow) return;
    for (let i = 0; i < wordLength; i++) {
      if (!evalRow[i]) continue;
      const letter = currentGuess[i]?.toUpperCase();
      if (!letter) continue;
      if (evalRow[i] === 'correct') correct[i] = letter;
      else if (evalRow[i] === 'wrong-position') present.add(letter);
      else if (evalRow[i] === 'incorrect') absent.add(letter);
    }
  });

  // Use Datamuse API to fetch suggestions for the correct word length
  const pattern = correct.map(l => (l ? l.toLowerCase() : '?')).join('');
  const url = `https://api.datamuse.com/words?sp=${pattern || '?'.repeat(wordLength)}&max=1000`;
  let suggestions = [];
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      suggestions = data
        .map(w => w.word.toUpperCase())
        .filter(word => {
          if (word.length !== wordLength || !/^[A-Z]+$/.test(word)) {
            return false;
          }
          // Must not contain any absent letters
          for (const letter of absent) {
            if (word.includes(letter)) return false;
          }
          // Must contain all present letters
          for (const letter of present) {
            if (!word.includes(letter)) return false;
          }
          // If user has typed some letters, must match those
          for (let i = 0; i < currentGuess.length; i++) {
            if (currentGuess[i] && word[i] !== currentGuess[i].toUpperCase()) return false;
          }
          return true;
        });
    }
  } catch (e) {
    // ignore
  }
  // Fallback to local dictionary if API fails or returns too few results
  if (!suggestions || suggestions.length < 5) {
    const allWords = (await getDictionaryWords(wordLength)).map(w => w.toUpperCase());
    suggestions = allWords.filter(word => {
      if (word.length !== wordLength) return false;
      for (const letter of absent) {
        if (word.includes(letter)) return false;
      }
      for (const letter of present) {
        if (!word.includes(letter)) return false;
      }
      for (let i = 0; i < correct.length; i++) {
        if (correct[i] && word[i] !== correct[i]) return false;
      }
      for (let i = 0; i < currentGuess.length; i++) {
        if (currentGuess[i] && word[i] !== currentGuess[i].toUpperCase()) return false;
      }
      return true;
    });
  }
  return suggestions.slice(0, 10);
}

/**
 * Get up to 10 5-letter words from Datamuse containing only the letters in the target word.
 * @param {string} targetWord - The word to match letter set.
 * @returns {Promise<string[]>}
 */
export async function getDatamuseSuggestions(targetWord, wordLength = 5, correct = null) {
  const uniqueLetters = Array.from(new Set(targetWord.toLowerCase().split('')));
  const allowed = new Set(uniqueLetters);
  const pattern = Array.isArray(correct) && correct.length === wordLength
    ? correct.map(l => (l ? l.toLowerCase() : '?')).join('')
    : '?'.repeat(wordLength);
  const url = `https://api.datamuse.com/words?sp=${pattern}&max=1000`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const filtered = data
      .map(w => w.word.toUpperCase())
      .filter(word =>
        word.length === wordLength &&
        word.split('').every(l => allowed.has(l.toLowerCase())) &&
        word.split('').some(l => allowed.has(l.toLowerCase()))
      );
    return filtered.slice(0, 10);
  } catch (e) {
    return [];
  }
}

/**
 * Get up to 10 5-letter words from Datamuse containing all correct and present letters in the right positions.
 * @param {string[]} correct - Array of 5 elements, correct[i] is the letter at position i or null.
 * @param {Set<string>} present - Set of letters that must be present somewhere in the word.
 * @returns {Promise<string[]>}
 */
export async function getDatamuseValidSuggestions(correct, present, wordLength = 5) {
  const pattern = Array.isArray(correct) && correct.length === wordLength
    ? correct.map(l => (l ? l.toLowerCase() : '?')).join('')
    : '?'.repeat(wordLength);
  const url = `https://api.datamuse.com/words?sp=${pattern}&max=1000`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const filtered = data
      .map(w => w.word.toUpperCase())
      .filter(word =>
        word.length === wordLength &&
        // All correct letters in correct positions
        correct.every((l, i) => !l || word[i] === l) &&
        // All present letters somewhere in the word
        Array.from(present).every(l => word.includes(l))
      );
    return filtered.slice(0, 10);
  } catch (e) {
    return [];
  }
}

/**
 * Get up to 20 5-letter word suggestions from the Datamuse API.
 * This function replaces the WordFinder API to resolve CORS issues.
 * It fetches a list of words matching known correct letters and then filters
 * them on the client-side based on present and absent letters.
 * @param {string[]} correct - Array of 5 elements, correct[i] is the letter at position i or null.
 * @param {Set<string>} present - Set of letters that must be present somewhere in the word.
 * @param {Set<string>} absent - Set of letters that must NOT be present in the word.
 * @returns {Promise<string[]>}
 */
export async function getWordFinderSuggestions(correct, present, absent = new Set(), wordLengthOrTarget, targetWordOrWrongPosition, wrongPositionParam = new Set()) {
  // Normalize parameters to support both old and new call signatures:
  // - new: (correct, present, absent, wordLength, targetWord, wrongPosition)
  // - old: (correct, present, absent, targetWord, wrongPosition)
  let wordLength = 5;
  let targetWord = undefined;
  let wrongPosition = new Set();

  if (typeof wordLengthOrTarget === 'number') {
    wordLength = wordLengthOrTarget;
    targetWord = targetWordOrWrongPosition;
    wrongPosition = wrongPositionParam || new Set();
  } else {
    // legacy/alternate signature where wordLength omitted
    targetWord = wordLengthOrTarget;
    wrongPosition = targetWordOrWrongPosition || new Set();
    if (Array.isArray(correct) && correct.length > 0) wordLength = correct.length;
  }

  // Build the 'spelled-like' pattern for Datamuse, e.g., 'a?p?l' or '?????'
  const pattern = Array.isArray(correct) && correct.length > 0
    ? correct.map(l => (l ? l.toLowerCase() : '?')).join('')
    : '?'.repeat(wordLength);
  const url = `https://api.datamuse.com/words?sp=${pattern}&max=1000`;

  let suggestions = [];
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      suggestions = data
        .map(w => w.word.toUpperCase())
        .filter(word => {
          if (word.length !== wordLength || !/^[A-Z]+$/.test(word) || word === targetWord) {
            return false;
          }
          // Rule 1: Must not contain any absent letters.
          for (const letter of absent) {
            if (word.includes(letter)) return false;
          }
          // Rule 2: Must contain all 'present' letters.
          for (const letter of present) {
            if (!word.includes(letter)) return false;
          }
          // Rule 3: Must not place letters in the same wrong position.
          for (const item of wrongPosition) {
            const [letter, position] = item.split('-');
            if (word[parseInt(position)] === letter) return false;
          }
          return true;
        });
    }
  } catch (e) {
    console.error('Error fetching suggestions from Datamuse:', e);
  }

  // If Datamuse returned nothing after applying stricter client-side filters,
  // try a pattern-only Datamuse request that matches known correct positions
  // (e.g. 'ter???' for a 6-letter word when correct = ['T','E','R',null,null,null]).
  if ((!suggestions || suggestions.length === 0) && Array.isArray(correct)) {
    try {
      const patternOnly = correct.map(l => (l ? l.toLowerCase() : '?')).join('');
      const url2 = `https://api.datamuse.com/words?sp=${patternOnly}&max=1000`;
      const resp2 = await fetch(url2);
      if (resp2.ok) {
        const data2 = await resp2.json();
        const patternResults = data2
          .map(w => w.word.toUpperCase())
          .filter(word => word.length === wordLength && /^[A-Z]+$/.test(word) && word !== targetWord)
          .filter(word => {
            // Exclude words containing absent letters
            for (const letter of absent) {
              if (word.includes(letter)) return false;
            }
            // Ensure present letters are included
            for (const letter of present) {
              if (!word.includes(letter)) return false;
            }
            // Exclude words that place letters in known-wrong positions
            for (const item of wrongPosition) {
              const [letter, position] = item.split('-');
              if (word[parseInt(position, 10)] === letter) return false;
            }
            return true;
          });
        if (patternResults && patternResults.length > 0) {
          suggestions = patternResults;
        }
      }
    } catch (e) {
      // ignore pattern-only fallback errors
    }
  }

  // Fallback: use local dictionary if Datamuse fails or returns too few results
  if (!suggestions || suggestions.length < 5) {
    try {
      const allWords = (await getDictionaryWords(wordLength)).map(w => w.toUpperCase());
      suggestions = allWords.filter(word => {
        if (word.length !== wordLength || word === targetWord) return false;
        for (const letter of absent) {
          if (word.includes(letter)) return false;
        }
        for (const letter of present) {
          if (!word.includes(letter)) return false;
        }
        for (const item of wrongPosition) {
          const [letter, position] = item.split('-');
          if (word[parseInt(position)] === letter) return false;
        }
        if (Array.isArray(correct)) {
          for (let i = 0; i < correct.length; i++) {
            if (correct[i] && word[i] !== correct[i]) return false;
          }
        }
        return true;
      });
    } catch (e) {
      // ignore
    }
  }
  return suggestions.slice(0, 20);
}
