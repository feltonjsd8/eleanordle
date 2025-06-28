// Returns up to 10 suggested words matching the user's current guess and known letter states
import { getDictionaryWords } from './dictionaryService';

/**
 * Filters words based on known correct, present, and absent letters.
 * @param {string[]} allWords - List of all possible 5-letter words.
 * @param {string} currentGuess - The user's current guess (may be partial).
 * @param {object} letterStates - { A: 'correct'|'wrong-position'|'incorrect' }
 * @param {Array} evaluations - Array of evaluations for each guess row
 * @returns {string[]} Up to 10 suggested words
 */
export async function getSuggestions(currentGuess, letterStates, evaluations) {
  const allWords = (await getDictionaryWords()).map(w => w.toUpperCase());
  // Build constraints from evaluations
  const correct = Array(5).fill(null);
  const present = new Set();
  const absent = new Set();

  evaluations.forEach((evalRow, rowIdx) => {
    if (!evalRow) return;
    for (let i = 0; i < 5; i++) {
      if (!evalRow[i]) continue;
      const letter = currentGuess[i]?.toUpperCase();
      if (!letter) continue;
      if (evalRow[i] === 'correct') correct[i] = letter;
      else if (evalRow[i] === 'wrong-position') present.add(letter);
      else if (evalRow[i] === 'incorrect') absent.add(letter);
    }
  });

  // Filter words
  const filtered = allWords.filter(word => {
    // Must match correct letters in position
    for (let i = 0; i < 5; i++) {
      if (correct[i] && word[i] !== correct[i]) return false;
    }
    // Must include all present letters (but not in the same position)
    for (let l of present) {
      if (!word.includes(l)) return false;
      for (let i = 0; i < 5; i++) {
        if (correct[i] !== l && word[i] === l) return false;
      }
    }
    // Must not include absent letters
    for (let l of absent) {
      if (word.includes(l)) return false;
    }
    // If user has typed some letters, must match those
    for (let i = 0; i < currentGuess.length; i++) {
      if (currentGuess[i] && word[i] !== currentGuess[i].toUpperCase()) return false;
    }
    return true;
  });
  return filtered.slice(0, 10);
}

/**
 * Get up to 10 5-letter words from Datamuse containing only the letters in the target word.
 * @param {string} targetWord - The word to match letter set.
 * @returns {Promise<string[]>}
 */
export async function getDatamuseSuggestions(targetWord) {
  const uniqueLetters = Array.from(new Set(targetWord.toLowerCase().split('')));
  const allowed = new Set(uniqueLetters);
  const url = `https://api.datamuse.com/words?sp=?????&max=1000`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const filtered = data
      .map(w => w.word.toUpperCase())
      .filter(word =>
        word.length === 5 &&
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
export async function getDatamuseValidSuggestions(correct, present) {
  const url = `https://api.datamuse.com/words?sp=?????&max=1000`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const filtered = data
      .map(w => w.word.toUpperCase())
      .filter(word =>
        word.length === 5 &&
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
export async function getWordFinderSuggestions(correct, present, absent = new Set()) {
  // Build the 'spelled-like' pattern for Datamuse, e.g., 'a?p?l'
  const pattern = correct.map(l => (l ? l.toLowerCase() : '?')).join('');
  const url = `https://api.datamuse.com/words?sp=${pattern}&max=1000`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error('Datamuse API request failed:', resp.status);
      return [];
    }
    const data = await resp.json();

    const suggestions = data
      .map(w => w.word.toUpperCase())
      .filter(word => {
        if (word.length !== 5 || !/^[A-Z]{5}$/.test(word)) {
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

        return true;
      });

    return suggestions.slice(0, 20);
  } catch (e) {
    console.error('Error fetching suggestions from Datamuse:', e);
    return [];
  }
}
