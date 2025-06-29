import React, { useEffect, useState } from 'react';
import '../styles/WordModal.css';

const SuggestionsModal = ({ isOpen, onClose, evaluations, guesses, onPickSuggestion }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    // Extract correct, present, and absent letters from all previous guesses.
    const correct = Array(5).fill(null);
    const present = new Set();
    const absent = new Set();
    const allCorrectOrPresentLetters = new Set();

    // First pass: identify all correct and present letters to avoid incorrectly marking them as absent.
    for (let row = 0; row < evaluations.length; row++) {
      const evalRow = evaluations[row];
      const guess = guesses[row] || '';
      if (!evalRow) continue;
      for (let i = 0; i < 5; i++) {
        const letter = guess[i]?.toUpperCase();
        if (!letter) continue;
        if (evalRow[i] === 'correct') {
          correct[i] = letter;
          allCorrectOrPresentLetters.add(letter);
        } else if (evalRow[i] === 'wrong-position') {
          present.add(letter);
          allCorrectOrPresentLetters.add(letter);
        }
      }
    }

    // Second pass: identify absent letters, ensuring they are not also correct or present.
    // This handles cases where a letter appears twice in a guess (e.g., 'SASSY') and one
    // instance is correct/present while the other is not.
    for (let row = 0; row < evaluations.length; row++) {
      const evalRow = evaluations[row];
      const guess = guesses[row] || '';
      if (!evalRow) continue;
      for (let i = 0; i < 5; i++) {
        const letter = guess[i]?.toUpperCase();
        if (!letter) continue;
        if (evalRow[i] === 'incorrect' && !allCorrectOrPresentLetters.has(letter)) {
          absent.add(letter);
        }
      }
    }
    import('../services/suggestionService').then(({ getWordFinderSuggestions }) =>
      getWordFinderSuggestions(correct, present, absent)
    ).then(words => {
      // Robustly handle different API response shapes
      let suggestions = [];
      if (Array.isArray(words)) {
        suggestions = words.filter(w => typeof w === 'string' && w.length === 5);
      } else if (words && Array.isArray(words.results)) {
        suggestions = words.results.map(w => w.word.toUpperCase()).filter(w => w.length === 5);
      }
      setSuggestions(suggestions);
      setLoading(false);
    });
  }, [isOpen, evaluations, guesses]);

  const handlePickRandom = () => {
    if (suggestions.length > 0 && onPickSuggestion) {
      const word = suggestions[Math.floor(Math.random() * suggestions.length)];
      onPickSuggestion(word);
      onClose();
    }
  };

  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Suggested Words</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {loading ? <p>Loading suggestions...</p> : suggestions.length === 0 ? (
            <p>No suggestions found.</p>
          ) : (
            <>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {suggestions.map((word, idx) => (
                  <li key={word + idx} style={{ fontSize: '1.2rem', margin: '8px 0' }}>{word}</li>
                ))}
              </ul>
              <button style={{marginTop: 16}} onClick={handlePickRandom}>Pick Random Suggestion</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuggestionsModal;
