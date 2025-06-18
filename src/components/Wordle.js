import React, { useState, useEffect } from 'react';
import '../styles/Wordle.css';
import { getRandomWord, getWordDefinition, isValidWord } from '../services/dictionaryService';
import WordModal from './WordModal';

const Wordle = ({ onBackToMenu }) => {
  const [guesses, setGuesses] = useState(Array(6).fill(''));
  const [currentGuess, setCurrentGuess] = useState('');
  const [currentRow, setCurrentRow] = useState(0);
  const [targetWord, setTargetWord] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  const [letterStates, setLetterStates] = useState({});
  const [evaluations, setEvaluations] = useState(Array(6).fill(null));
  const [revealedLetters, setRevealedLetters] = useState(Array(6).fill(Array(5).fill(false)));
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [wordDefinition, setWordDefinition] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [completedWord, setCompletedWord] = useState('');
  const [showClue, setShowClue] = useState(false);
  const [clue, setClue] = useState('');

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
      setRevealedLetters(Array(6).fill(Array(5).fill(false)));
      setIsSuccess(false);
      setCompletedWord('');
      setShowClue(false);
      setClue('');
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
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < 5) {
      // Only allow letters
      if (/^[A-Z]$/.test(key)) {
        setCurrentGuess(prev => prev + key);
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

  // Modify submitGuess to track category progress
  const submitGuess = async () => {
    // First validate that the guess is a real word
    const isValid = await isValidWord(currentGuess);
    if (!isValid) {
      showMessage('Not a valid word');
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
      setGameOver(true);
      setIsSuccess(true);
      setCompletedWord(targetWord);
      // Get definition for the modal
      try {
        const def = await getWordDefinition(targetWord);
        setWordDefinition(def);
        setShowModal(true);
      } catch (error) {
        console.error('Error fetching definition:', error);
      }
    } else if (currentRow === 5) {
      setGameOver(true);
      setCompletedWord(targetWord);
      // Get definition for the modal
      try {
        const def = await getWordDefinition(targetWord);
        setWordDefinition(def);
        setShowModal(true);
      } catch (error) {
        console.error('Error fetching definition:', error);
      }
    } else {
      setCurrentRow(currentRow + 1);
      setCurrentGuess('');
    }
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 2000);
  };  const getTileClass = (letter, index, rowIndex) => {
    if (rowIndex > currentRow) return '';
    
    const classes = [];
    
    // Add evaluation classes for submitted rows
    if (rowIndex < currentRow) {
      const evaluation = evaluations[rowIndex];
      if (evaluation) {
        classes.push(evaluation[index]);
      }
    }
    
    // Add flip animation class for the last submitted row
    if (rowIndex === currentRow - 1 || (rowIndex === currentRow && gameOver)) {
      classes.push('flip');
    }
    
    // Handle correct guess case
    if (rowIndex === currentRow && evaluations[rowIndex]) {
      classes.push(evaluations[rowIndex][index]);
    }
    
    return classes.join(' ');
  };

  const getFlipDelay = (index) => ({
    '--flip-delay': `${index * 200}ms`
  });

  const getClue = async () => {
    if (!targetWord) return;
    try {
      const def = await getWordDefinition(targetWord);
      setClue(def.definitions[0]?.definition || 'No clue available');
      setShowClue(true);
    } catch (e) {
      setClue('No clue available');
      setShowClue(true);
    }
  };

  return (
    <div className="wordle">
      <div className="game-header">
        <div className="header-content">
          <h1>Wordle</h1>
        </div>
        <div className="header-buttons">
          <button onClick={startNewGame} className="new-game-button">
            New Game
          </button>
          <button onClick={onBackToMenu} className="menu-button">
            Back to Menu
          </button>
        </div>
      </div>

      {message && <div className="message">{message}</div>}
      {isLoading && <div className="loading">Loading words...</div>}

      <div className="game-container">
        <div className="wordle-grid">
          {guesses.map((guess, rowIndex) => (
            <div key={rowIndex} className="wordle-row">
              {Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className={`wordle-tile ${getTileClass(guess[index], index, rowIndex)}`}
                  style={getFlipDelay(index)}
                >
                  {rowIndex === currentRow && index < currentGuess.length
                    ? currentGuess[index]
                    : guess[index] || ''}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 10 }}>
          <button className="clue-button" onClick={getClue} disabled={showClue} style={{marginBottom: 8}}>
            Get Clue
          </button>
          {showClue && clue && (
            <div className="clue-text" style={{marginBottom: 8, color: '#1a73e8', fontStyle: 'italic'}}>
              Clue: {clue}
            </div>
          )}
        </div>
        <div className="keyboard">
          {[
            'QWERTYUIOP',
            'ASDFGHJKL',
            'ZXCVBNM'
          ].map((row, i) => (
            <div key={i} className="keyboard-row">
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