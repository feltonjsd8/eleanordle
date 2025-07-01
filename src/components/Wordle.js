import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/Wordle.css';
import { getRandomWord, getWordDefinition, isValidWord, getDictionaryWords } from '../services/dictionaryService';
import WordModal from './WordModal';
import { getSuggestions } from '../services/suggestionService';

const Wordle = ({ onBackToMenu }) => {
  const [guesses, setGuesses] = useState(Array(6).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [currentRow, setCurrentRow] = useState(0);
  const [targetWord, setTargetWord] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  const [letterStates, setLetterStates] = useState({});
  const [evaluations, setEvaluations] = useState(Array(6).fill(null));
  const [revealedLetters, setRevealedLetters] = useState(Array(6).fill(null).map(() => Array(5).fill(false)));
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [wordDefinition, setWordDefinition] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [completedWord, setCompletedWord] = useState('');
  const [showClue, setShowClue] = useState(false);
  const [clue, setClue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [revealedAnswerRow, setRevealedAnswerRow] = useState(null);
  const [invalidGuess, setInvalidGuess] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState([]);
  const inputRef = useRef();
  const menuRef = useRef();

  const startNewGame = async () => {
    setIsLoading(true);
    try {
      const newWord = await getRandomWord();
      setTargetWord(newWord);
      setGuesses(Array(6).fill(''));
      setCurrentGuess('');
      setCurrentRow(0);
      setGameOver(false);
      setMessage('');
      setLetterStates({});
      setEvaluations(Array(6).fill(null));
      setRevealedLetters(Array(6).fill(null).map(() => Array(5).fill(false)));
      setIsSuccess(false);
      setCompletedWord('');
      setShowClue(false);
      setClue('');
      setUsedSuggestions([]);
      setRevealedAnswerRow(null);
    } catch (error) {
      console.error('Error selecting word:', error);
      showMessage('Error loading word. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    startNewGame();
  }, []);

  const handleKeyPress = (key) => {
    if (gameOver) return;

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        showMessage('Word must be 5 letters');
        return;
      }
      submitGuess();
    } else if (key === 'BACKSPACE') {
      setCurrentGuess(prev => {
        const newGuess = prev.slice(0, -1);
        if (invalidGuess && newGuess.length < 5) setInvalidGuess(false);
        return newGuess;
      });
    } else if (currentGuess.length < 5) {
      // Only allow letters
      if (/^[A-Z]$/.test(key)) {
        setCurrentGuess(prev => {
          const newGuess = prev + key;
          if (invalidGuess && newGuess.length < 5) setInvalidGuess(false);
          return newGuess;
        });
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        handleKeyPress('ENTER');
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACKSPACE');
      } else if (/^[A-Za-z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, gameOver]);

  useEffect(() => {
    if (currentGuess.length === 5) {
      (async () => {
        const isValid = await isValidWord(currentGuess);
        setInvalidGuess(!isValid);
      })();
    } else if (invalidGuess && currentGuess.length < 5) {
      setInvalidGuess(false);
    }
  }, [currentGuess]);

  const evaluateGuess = (guess, target) => {
    const evaluation = Array(5).fill('incorrect');
    const targetLetters = target.split('');
    const guessLetters = guess.split('');
    
    // First pass: mark correct positions
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        evaluation[i] = 'correct';
        targetLetters[i] = null;
        guessLetters[i] = null;
      }
    }
    
    // Second pass: mark wrong positions
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === null) continue;
      
      const targetIndex = targetLetters.indexOf(guessLetters[i]);
      if (targetIndex !== -1) {
        evaluation[i] = 'wrong-position';
        targetLetters[targetIndex] = null;
      }
    }
    
    return evaluation;
  };

  const handleNextWord = async () => {
    setShowModal(false);
    await startNewGame();
  };
  const showGameEndModal = async (success, word) => {
    setIsSuccess(success);
    try {
      const definition = await getWordDefinition(word);
      setWordDefinition(definition);
    } catch (error) {
      console.error('Error fetching word definition:', error);
      setWordDefinition({
        word: word,
        definitions: [{ definition: 'Definition not available' }]
      });
    }
    setShowModal(true);
  };

  // Helper to reveal each letter in the row with a delay
  const revealRowLetters = (rowIndex) => {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        setRevealedLetters(prev => {
          const updated = prev.map(arr => [...arr]);
          updated[rowIndex][i] = true;
          return updated;
        });
      }, i * 200); // 200ms per tile
    }
  };

  // Modify submitGuess to reveal letters one by one
  const submitGuess = async () => {
    // First validate that the guess is a real word
    const isValid = await isValidWord(currentGuess);
    if (!isValid) {
      return;
    }

    const evaluation = evaluateGuess(currentGuess, targetWord);

    // Update evaluations
    const newEvaluations = [...evaluations];
    newEvaluations[currentRow] = evaluation;
    setEvaluations(newEvaluations);

    // Update guesses
    const newGuesses = [...guesses];
    newGuesses[currentRow] = currentGuess;
    setGuesses(newGuesses);

    // Reset revealedLetters for this row
    setRevealedLetters(prev => {
      const updated = prev.map(arr => [...arr]);
      updated[currentRow] = Array(5).fill(false);
      return updated;
    });

    // Reveal each letter with a delay
    revealRowLetters(currentRow);

    // Update letter states for keyboard
    const newLetterStates = { ...letterStates };
    for (let i = 0; i < currentGuess.length; i++) {
      const letter = currentGuess[i];
      const currentState = newLetterStates[letter];
      const newState = evaluation[i];
      if (currentState !== 'correct') {
        if (newState === 'correct' || 
           (newState === 'wrong-position' && currentState !== 'wrong-position') ||
           (!currentState && newState === 'incorrect')) {
          newLetterStates[letter] = newState;
        }
      }
    }
    setLetterStates(newLetterStates);

    // Check if game is over
    if (currentGuess === targetWord) {
      setTimeout(() => {
        setGameOver(true);
        setIsSuccess(true);
        setCompletedWord(targetWord);
        // Get definition for the modal
        getWordDefinition(targetWord).then(def => {
          setWordDefinition(def);
          setShowModal(true);
        }).catch(() => {});
      }, 5 * 200 + 200); // Wait for all tiles to flip
    } else if (currentRow === 5) {
      setTimeout(() => {
        setGameOver(true);
        setCompletedWord(targetWord);
        getWordDefinition(targetWord).then(def => {
          setWordDefinition(def);
          setShowModal(true);
        }).catch(() => {});
      }, 5 * 200 + 200);
    } else {
      setTimeout(() => {
        setCurrentRow(currentRow + 1);
        setCurrentGuess('');
      }, 5 * 200 + 100);
    }
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2000);
  };  const getTileClass = (letter, index, rowIndex) => {
    if (rowIndex > currentRow) return '';

    const classes = [];

    // Add evaluation classes for submitted rows, but only if revealed
    if (rowIndex < currentRow) {
      const evaluation = evaluations[rowIndex];
      if (evaluation && revealedLetters[rowIndex][index]) {
        classes.push(evaluation[index]);
        classes.push('flip'); // Only flip when revealed
      }
    }

    // Handle correct guess case (current row, after evaluation, and revealed)
    if (rowIndex === currentRow && evaluations[rowIndex] && revealedLetters[rowIndex][index]) {
      classes.push(evaluations[rowIndex][index]);
      classes.push('flip'); // Only flip when revealed
    }

    // Add class for revealed answer row
    if (rowIndex === revealedAnswerRow) {
      classes.push('revealed-answer');
    }

    return classes.join(' ');
  };

  const getFlipDelay = (index) => ({
    '--flip-delay': `${index * 200}ms`
  });

  const getClue = useCallback(async () => {
    if (!targetWord) return;
    try {
      const def = await getWordDefinition(targetWord);
      setClue(def.definitions[0]?.definition || 'No clue available');
      setShowClue(true);
    } catch (e) {
      setClue('No clue available');
      setShowClue(true);
    }
  }, [targetWord]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClick);
    } else {
      document.removeEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const revealAnswer = async () => {
    if (gameOver) return;
    let revealRow = guesses.findIndex(g => g === '');
    if (revealRow === -1) revealRow = guesses.length - 1;

    setRevealedAnswerRow(revealRow); // Mark this row as the revealed answer row

    const answer = targetWord;
    const evaluation = evaluateGuess(answer, targetWord);
    const newGuesses = [...guesses];
    const newEvaluations = [...evaluations];
    newGuesses[revealRow] = answer;
    newEvaluations[revealRow] = evaluation;
    setGuesses(newGuesses);
    setEvaluations(newEvaluations);
    setCurrentGuess('');

    // Reset revealedLetters for this row
    setRevealedLetters(prev => {
      const updated = prev.map(arr => [...arr]);
      updated[revealRow] = Array(5).fill(false);
      return updated;
    });

    // Reveal each letter with a delay
    revealRowLetters(revealRow);

    // Update letter states for keyboard
    const newLetterStates = { ...letterStates };
    for (let i = 0; i < answer.length; i++) {
      const letter = answer[i];
      newLetterStates[letter] = evaluation[i];
    }
    setLetterStates(newLetterStates);

    // Show modal after animation
    setTimeout(async () => {
      setGameOver(true);
      setIsSuccess(true);
      setCompletedWord(targetWord);
      try {
        const def = await getWordDefinition(targetWord);
        setWordDefinition(def);
        setShowModal(true);
      } catch (error) {
        setShowModal(true);
      }
    }, 5 * 200 + 200);
    setMenuOpen(false);
  };

  // Replace handleShowSuggestions to auto-pick and submit a suggestion
  const handleShowSuggestions = useCallback(async () => {
    setIsLoading(true);
    const correct = Array(5).fill(null);
    const wrongPosition = new Set();
    const present = new Set(); // <-- Add this line
    const absent = new Set();  // <-- Add this line
    for (let row = 0; row < evaluations.length; row++) {
      const evalRow = evaluations[row];
      const guess = guesses[row] || '';
      if (!evalRow) continue;
      for (let i = 0; i < 5; i++) {
        const letter = guess[i]?.toUpperCase();
        if (!letter) continue;
        if (evalRow[i] === 'correct') correct[i] = letter;
        else if (evalRow[i] === 'wrong-position') {
          present.add(letter);
          wrongPosition.add(`${letter}-${i}`);
        } else if (evalRow[i] === 'incorrect') absent.add(letter);
      }
    }
    const { getWordFinderSuggestions } = await import('../services/suggestionService');
    const words = await getWordFinderSuggestions(correct, present, absent, targetWord, wrongPosition);
    const availableWords = words.filter(word => !usedSuggestions.includes(word));
    setIsLoading(false);
    if (availableWords.length > 0) {
      const newSuggestion = availableWords[Math.floor(Math.random() * availableWords.length)];
      setUsedSuggestions([...usedSuggestions, newSuggestion]);
      setCurrentGuess(newSuggestion);
      setPendingSuggestion(true);
    } else {
      // If no suggestions are found, fetch more words and try again
      setIsLoading(true);
      const newWords = await getDictionaryWords();
      const newAvailableWords = newWords.filter(word => !usedSuggestions.includes(word));
      setIsLoading(false);
      if (newAvailableWords.length > 0) {
        const newSuggestion = newAvailableWords[Math.floor(Math.random() * newAvailableWords.length)];
        setUsedSuggestions([...usedSuggestions, newSuggestion]);
        setCurrentGuess(newSuggestion);
        setPendingSuggestion(true);
      } else {
        showMessage('No new suggestions found');
      }
    }
  }, [evaluations, guesses]);

  // Effect to auto-submit after suggestion is set
  useEffect(() => {
    if (pendingSuggestion && currentGuess.length === 5) {
      setPendingSuggestion(false);
      submitGuess();
    }
  }, [pendingSuggestion, currentGuess]);

  // Compute absent letters: guessed but not in targetWord
  const absentLetters = Array.from(new Set(
    guesses
      .join('')
      .split('')
      .filter(l => l && !targetWord.includes(l))
  ));

  // Keyboard shortcuts for menu options
  useEffect(() => {
    const handleMenuShortcuts = (e) => {
      if (e.altKey && e.shiftKey && !e.ctrlKey) {
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          if (!showClue) getClue();
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleShowSuggestions();
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          startNewGame();
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          revealAnswer();
        }
      }
    };
    window.addEventListener('keydown', handleMenuShortcuts);
    return () => window.removeEventListener('keydown', handleMenuShortcuts);
  }, [showClue, getClue, handleShowSuggestions]);

  return (
    <div className="wordle">
      {/* Visually hidden input for accessibility and to ensure input is always captured */}
      <input
        ref={inputRef}
        type="text"
        value={currentGuess}
        maxLength={5}
        autoFocus
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
        }}
        tabIndex={-1}
        aria-label="Wordle guess input"
      />

      <div className="game-header">
        <div className="header-content">
          <h1>
            <span className="title-highlight">Eleanor</span>dle
          </h1>
        </div>
        <div className="header-actions">
          <button onClick={getClue} className="header-icon-btn" disabled={showClue} title="Get Clue (Alt+Shift+C)" aria-label="Get Clue">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
              <path d="M0 0h24v24H0V0z" fill="none"/>
              <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
            </svg>
          </button>
          <button onClick={handleShowSuggestions} className="header-icon-btn" title="Suggest Word (Alt+Shift+S)" aria-label="Suggest Word">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
              <path d="M0 0h24v24H0V0z" fill="none"/><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>
          <div className="burger-menu-anchor">
            <button
              className="burger-menu-btn"
              aria-label="Open menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="burger-bar"></span>
              <span className="burger-bar"></span>
              <span className="burger-bar"></span>
            </button>
            {menuOpen && (
              <div className="burger-dropdown" ref={menuRef}>
                <button onClick={() => { startNewGame(); setMenuOpen(false); }} className="dropdown-item">New Game</button>
                <button onClick={() => { revealAnswer(); setMenuOpen(false); }} className="dropdown-item">Reveal</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Move the message above the game-container and add a higher z-index/style for visibility */}
      {message && (
        <div className="message" style={{ position: 'relative', zIndex: 10, margin: '12px 0', fontWeight: 'bold', color: '#b91c1c', background: '#fffbe6', border: '1px solid #fbbf24', borderRadius: 6, padding: '8px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          {message}
        </div>
      )}
      {isLoading && <div className="loading">Loading words...</div>}

      <div className="game-container">
        <div className="wordle-grid">
          {guesses.map((guess, rowIndex) => (
            <div key={rowIndex} className="wordle-row">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className={`wordle-tile ${getTileClass(guess[index], index, rowIndex)}${rowIndex === currentRow && invalidGuess ? ' invalid' : ''}`}
                  style={getFlipDelay(index)}
                >
                  {/* Show the correct answer letters in white for the revealed answer row, regardless of animation */}
                  {rowIndex === revealedAnswerRow ? targetWord[index] : (rowIndex === currentRow ? currentGuess[index] || '' : guesses[rowIndex][index] || '')}
                </div>
              ))}
            </div>
          ))}
        </div>
        {showClue && clue && (
          <div className="clue-text" style={{marginBottom: 8, color: '#1a73e8', fontStyle: 'italic'}}>
            Clue: {clue}
          </div>
        )}
        <div className="keyboard">
          {[
            'QWERTYUIOP', // 10 keys: Q W E R T Y U I O P
            'ASDFGHJKL', // 9 keys: A S D F G H J K L
            'ZXCVBNM',     // 7 keys: Z X C V B N M
          ].map((row, i) => (
            <div key={i} className="keyboard-row">
              {/* Place ENTER and BACKSPACE on the last row */}
              {i === 2 && (
                <button 
                  className="key" 
                  onClick={() => handleKeyPress('ENTER')}
                  data-key="ENTER"
                >
                  ENTER
                </button>
              )}
              {row.split('').map(key => (
                <button
                  key={key}
                  className={`key ${letterStates[key] || ''}`}
                  onClick={() => handleKeyPress(key)}
                  data-key={key}
                >
                  {key}
                </button>
              ))}
              {i === 2 && (
                <button 
                  className="key" 
                  onClick={() => handleKeyPress('BACKSPACE')}
                  data-key="BACKSPACE"
                >
                  ←
                </button>
              )}
            </div>
          ))}
        </div>
      </div>      <WordModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        word={completedWord}
        definition={wordDefinition}
        isSuccess={isSuccess}
        onNextWord={handleNextWord}
      />
    </div>
  );
};

export default Wordle;