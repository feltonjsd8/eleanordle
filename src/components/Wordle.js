import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import '../styles/Wordle.css';
import { getRandomWord, getWordDefinition, isValidWord, getDictionaryWords } from '../services/dictionaryService';
import WordModal from './WordModal';
import DefinitionModal from './DefinitionModal';
import { getSuggestions } from '../services/suggestionService';
import Logo from './Logo';

const DEFAULT_WORD_LENGTH = 3;
const MAX_WORD_LENGTH = 10;
const initialState = {
  guesses: Array(6).fill(''),
  currentGuess: '',
  currentRow: 0,
  targetWord: '',
  wordLength: DEFAULT_WORD_LENGTH,
  gameOver: false,
  message: '',
  letterStates: {},
  evaluations: Array(6).fill(null).map(() => Array(DEFAULT_WORD_LENGTH).fill(null)),
  revealedLetters: Array(6).fill(null).map(() => Array(DEFAULT_WORD_LENGTH).fill(false)),
  isLoading: false,
  showModal: false,
  wordDefinition: null,
  isSuccess: false,
  completedWord: '',
  showClue: true,
  clue: '',
  menuOpen: false,
  showDefinitionModal: false,
  definitionModalWord: null,
  definitionModalDefinition: null,
  revealedAnswerRow: null,
  invalidGuess: false,
  pendingSuggestion: false,
  usedSuggestions: [],
  isContrastMode: false,
  alwaysShowClue: true,
  wrongPositionHistory: {},
  // Track the current word length for progression
  nextWordLength: DEFAULT_WORD_LENGTH,
};

function reducer(state, action) {
  switch (action.type) {
    case 'RESET': {
      const alwaysShowClue = state.alwaysShowClue;
      const wordLength = action.wordLength || (action.targetWord ? action.targetWord.length : DEFAULT_WORD_LENGTH);
      return {
        ...initialState,
        targetWord: action.targetWord,
        wordLength,
        guesses: Array(6).fill(''),
        evaluations: Array(6).fill(null).map(() => Array(wordLength).fill(null)),
        revealedLetters: Array(6).fill(null).map(() => Array(wordLength).fill(false)),
        alwaysShowClue,
        showClue: alwaysShowClue ? true : false,
        nextWordLength: state.nextWordLength,
      };
    }
    case 'SET_NEXT_WORD_LENGTH':
      return { ...state, nextWordLength: action.nextWordLength };
    case 'SET_GUESSES':
      return { ...state, guesses: action.guesses };
    case 'SET_CURRENT_GUESS':
      return { ...state, currentGuess: action.currentGuess };
    case 'SET_CURRENT_ROW':
      return { ...state, currentRow: action.currentRow };
    case 'SET_GAME_OVER':
      return { ...state, gameOver: action.gameOver };
    case 'SET_MESSAGE':
      return { ...state, message: action.message };
    case 'SET_LETTER_STATES':
      return { ...state, letterStates: action.letterStates };
    case 'SET_EVALUATIONS':
      return { ...state, evaluations: action.evaluations };
    case 'SET_REVEALED_LETTERS':
      return { ...state, revealedLetters: action.revealedLetters };
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_SHOW_MODAL':
      return { ...state, showModal: action.showModal };
    case 'SET_WORD_DEFINITION':
      return { ...state, wordDefinition: action.wordDefinition };
    case 'SET_IS_SUCCESS':
      return { ...state, isSuccess: action.isSuccess };
    case 'SET_COMPLETED_WORD':
      return { ...state, completedWord: action.completedWord };
    case 'SET_SHOW_CLUE':
      return { ...state, showClue: action.showClue };
    case 'SET_CLUE':
      return { ...state, clue: action.clue };
    case 'SET_MENU_OPEN':
      return { ...state, menuOpen: action.menuOpen };
    case 'SET_SHOW_DEFINITION_MODAL':
      return { ...state, showDefinitionModal: action.showDefinitionModal };
    case 'SET_DEFINITION_MODAL_WORD':
      return { ...state, definitionModalWord: action.definitionModalWord };
    case 'SET_DEFINITION_MODAL_DEFINITION':
      return { ...state, definitionModalDefinition: action.definitionModalDefinition };
    case 'SET_REVEALED_ANSWER_ROW':
      return { ...state, revealedAnswerRow: action.revealedAnswerRow };
    case 'SET_INVALID_GUESS':
      return { ...state, invalidGuess: action.invalidGuess };
    case 'SET_PENDING_SUGGESTION':
      return { ...state, pendingSuggestion: action.pendingSuggestion };
    case 'SET_USED_SUGGESTIONS':
      return { ...state, usedSuggestions: action.usedSuggestions };
    case 'SET_IS_CONTRAST_MODE':
      return { ...state, isContrastMode: action.isContrastMode };
    case 'SET_TARGET_WORD':
      return { ...state, targetWord: action.targetWord };
    case 'SET_ALWAYS_SHOW_CLUE':
      return { ...state, alwaysShowClue: action.alwaysShowClue };
    // SET_ROW_SCORES removed
    case 'REVEAL_LETTER': {
      // Reveal a single letter in a row
      const { rowIndex, letterIndex } = action;
      const revealedLetters = state.revealedLetters.map((arr, idx) => {
        if (idx !== rowIndex) return arr;
        const newArr = arr.slice();
        newArr[letterIndex] = true;
        return newArr;
      });
      return { ...state, revealedLetters };
    }
    // SET_ANIMATE_SCORE, SET_ANIMATE_STREAK removed
    default:
      return state;
  }
}


const Wordle = ({ onBackToMenu, initialWordLength }) => {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    wordLength: initialWordLength || DEFAULT_WORD_LENGTH,
    nextWordLength: initialWordLength || DEFAULT_WORD_LENGTH,
    guesses: Array(6).fill(''),
    evaluations: Array(6).fill(null).map(() => Array(initialWordLength || DEFAULT_WORD_LENGTH).fill(null)),
    revealedLetters: Array(6).fill(null).map(() => Array(initialWordLength || DEFAULT_WORD_LENGTH).fill(false)),
  });
  const inputRef = useRef();
  const menuRef = useRef();
  // Cache for word definitions to avoid unnecessary API calls
  const definitionCache = useRef({});

  const startNewGame = async (customWordLength) => {
    dispatch({ type: 'SET_IS_LOADING', isLoading: true });
    try {
      // Use the provided word length, or the nextWordLength from state, or the initialWordLength prop
      const wordLength = customWordLength || state.nextWordLength || initialWordLength || DEFAULT_WORD_LENGTH;
      const newWord = await getRandomWord(wordLength);
      dispatch({
        type: 'RESET',
        targetWord: newWord,
        wordLength
      });
      try {
        const def = await getWordDefinition(newWord);
        dispatch({ type: 'SET_CLUE', clue: def.definitions[0]?.definition || 'No clue available' });
        dispatch({ type: 'SET_SHOW_CLUE', showClue: true });
      } catch (e) {
        dispatch({ type: 'SET_CLUE', clue: 'No clue available' });
        dispatch({ type: 'SET_SHOW_CLUE', showClue: true });
      }
    } catch (error) {
      console.error('Error selecting word:', error);
      showMessage('Error loading word. Please try again.');
    } finally {
      dispatch({ type: 'SET_IS_LOADING', isLoading: false });
    }
  };

  useEffect(() => {
    startNewGame(initialWordLength || DEFAULT_WORD_LENGTH);
    // eslint-disable-next-line
  }, []);

  const handleKeyPress = async (key) => {
    if (state.gameOver) return;

    if (key === 'ENTER') {
      if (state.currentGuess.length !== state.wordLength) {
        showMessage(`Word must be ${state.wordLength}`);
        return;
      }
      // Check validity before allowing guess
      const isValid = await isValidWord(state.currentGuess);
      if (!isValid) {
        dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: true });
        showMessage('Not a valid word');
        return;
      }
      submitGuess();
    } else if (key === 'BACKSPACE') {
      const newGuess = state.currentGuess.slice(0, -1);
      if (state.invalidGuess && newGuess.length < state.wordLength) dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: false });
      dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: newGuess });
    } else if (state.invalidGuess) {
      // Block further typing if guess is invalid until user deletes a letter
      return;
    } else if (state.currentGuess.length < state.wordLength) {
      if (/^[A-Z]$/.test(key)) {
        const newGuess = state.currentGuess + key;
        dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: newGuess });
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
    // eslint-disable-next-line
  }, [state.currentGuess, state.gameOver]);

  useEffect(() => {
    if (state.currentGuess.length === state.wordLength) {
      (async () => {
        const isValid = await isValidWord(state.currentGuess);
        dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: !isValid });
      })();
    } else if (state.invalidGuess && state.currentGuess.length < state.wordLength) {
      dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: false });
    }
  }, [state.currentGuess, state.wordLength]);

  const evaluateGuess = (guess, target) => {
    if (!guess || !target || typeof guess !== 'string' || typeof target !== 'string') {
      return [];
    }
    const wordLength = Math.min(guess.length, target.length);
    const evaluation = Array(wordLength).fill('incorrect');
    const targetLetters = target.split('');
    const guessLetters = guess.split('');
    for (let i = 0; i < wordLength; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        evaluation[i] = 'correct';
        targetLetters[i] = null;
        guessLetters[i] = null;
      }
    }
    for (let i = 0; i < wordLength; i++) {
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
    dispatch({ type: 'SET_SHOW_MODAL', showModal: false });
    // If last game was a failure, reset to 3 letters
    let nextLength = state.isSuccess ? state.wordLength + 1 : 3;
    if (nextLength > MAX_WORD_LENGTH) nextLength = MAX_WORD_LENGTH;
    dispatch({ type: 'SET_NEXT_WORD_LENGTH', nextWordLength: nextLength });
    await startNewGame(nextLength);
  };

  const showGameEndModal = async (success, word) => {
    dispatch({ type: 'SET_IS_SUCCESS', isSuccess: success });
    try {
      const definition = await getWordDefinition(word);
      dispatch({ type: 'SET_WORD_DEFINITION', wordDefinition: definition });
    } catch (error) {
      console.error('Error fetching word definition:', error);
      dispatch({ type: 'SET_WORD_DEFINITION', wordDefinition: { word, definitions: [{ definition: 'Definition not available' }] } });
    }
    dispatch({ type: 'SET_SHOW_MODAL', showModal: true });
  };

  const handleShowDefinition = async (word) => {
    dispatch({ type: 'SET_DEFINITION_MODAL_WORD', definitionModalWord: word });
    try {
      let definition = definitionCache.current[word];
      if (!definition) {
        definition = await getWordDefinition(word);
        definitionCache.current[word] = definition;
      }
      dispatch({ type: 'SET_DEFINITION_MODAL_DEFINITION', definitionModalDefinition: definition });
    } catch (error) {
      console.error('Error fetching definition:', error);
      const fallback = { word, definitions: [{ definition: 'Definition not available' }] };
      definitionCache.current[word] = fallback;
      dispatch({ type: 'SET_DEFINITION_MODAL_DEFINITION', definitionModalDefinition: fallback });
    }
    dispatch({ type: 'SET_SHOW_DEFINITION_MODAL', showDefinitionModal: true });
  };

  const revealRowLetters = (rowIndex) => {
    const wordLength = state.wordLength;
    for (let i = 0; i < wordLength; i++) {
      setTimeout(() => {
        dispatch({ type: 'REVEAL_LETTER', rowIndex, letterIndex: i });
      }, i * 200);
    }
  };

  const submitGuess = async () => {
    // Assume validity already checked in handleKeyPress
    const evaluation = evaluateGuess(state.currentGuess, state.targetWord);
    // scoring removed
    const newLetterStates = { ...state.letterStates }; // Get current letter states
    const newWrongPositionHistory = JSON.parse(JSON.stringify(state.wrongPositionHistory || {}));

    // scoring logic removed
    dispatch({ type: 'SET_WRONG_POSITION_HISTORY', wrongPositionHistory: newWrongPositionHistory });
    const newEvaluations = [...state.evaluations];
    newEvaluations[state.currentRow] = evaluation;
    dispatch({ type: 'SET_EVALUATIONS', evaluations: newEvaluations });
    const newGuesses = [...state.guesses];
    newGuesses[state.currentRow] = state.currentGuess;
    dispatch({ type: 'SET_GUESSES', guesses: newGuesses });
    // Always create a new revealedLetters array for the row
    dispatch({ type: 'SET_REVEALED_LETTERS', revealedLetters: state.revealedLetters.map((arr, idx) => idx === state.currentRow ? Array(state.wordLength).fill(false) : arr.slice()) });
    revealRowLetters(state.currentRow);
    // Update letter states for keyboard
    for (let i = 0; i < state.currentGuess.length; i++) {
      const letter = state.currentGuess[i];
      const currentState = newLetterStates[letter];
      const newState = evaluation[i];
      // Only upgrade state, never downgrade
      if (newState === 'correct') {
        newLetterStates[letter] = 'correct';
      } else if (newState === 'wrong-position') {
        if (currentState !== 'correct' && currentState !== 'wrong-position') {
          newLetterStates[letter] = 'wrong-position';
        }
      } else if (newState === 'incorrect') {
        if (!currentState) {
          newLetterStates[letter] = 'incorrect';
        }
      }
    }
    dispatch({ type: 'SET_LETTER_STATES', letterStates: newLetterStates });

    // Prefetch and cache the definition for the guess (if not already cached)
    const guessWord = state.currentGuess;
    if (!definitionCache.current[guessWord]) {
      getWordDefinition(guessWord).then(def => {
        definitionCache.current[guessWord] = def;
      }).catch(() => {
        definitionCache.current[guessWord] = { word: guessWord, definitions: [{ definition: 'Definition not available' }] };
      });
    }

    if (state.currentGuess === state.targetWord) {
      setTimeout(() => {
        dispatch({ type: 'SET_GAME_OVER', gameOver: true });
        dispatch({ type: 'SET_IS_SUCCESS', isSuccess: true });
        dispatch({ type: 'SET_COMPLETED_WORD', completedWord: state.targetWord });
        getWordDefinition(state.targetWord).then(def => {
          dispatch({ type: 'SET_WORD_DEFINITION', wordDefinition: def });
          dispatch({ type: 'SET_SHOW_MODAL', showModal: true });
        }).catch(() => {});
      }, 5 * 200 + 200);
    } else if (state.currentRow === 5) {
      setTimeout(() => {
        dispatch({ type: 'SET_GAME_OVER', gameOver: true });
        dispatch({ type: 'SET_COMPLETED_WORD', completedWord: state.targetWord });
        // Reset word length to 3 on failure
        dispatch({ type: 'SET_NEXT_WORD_LENGTH', nextWordLength: 3 });
        getWordDefinition(state.targetWord).then(def => {
          dispatch({ type: 'SET_WORD_DEFINITION', wordDefinition: def });
          dispatch({ type: 'SET_SHOW_MODAL', showModal: true });
        }).catch(() => {});
      }, 5 * 200 + 200);
    } else {
      setTimeout(() => {
        dispatch({ type: 'SET_CURRENT_ROW', currentRow: state.currentRow + 1 });
        dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: '' });
      }, 5 * 200 + 100);
    }
  };

  // Ensure error messages are visible for at least 1 second
  const messageTimeoutRef = useRef();
  const showMessage = (msg) => {
    dispatch({ type: 'SET_MESSAGE', message: msg });
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'SET_MESSAGE', message: '' });
      messageTimeoutRef.current = null;
    }, 1000); // 1 second minimum
  };
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  const getTileClass = (letter, index, rowIndex) => {
    if (rowIndex > state.currentRow) return '';
    const classes = [];
    if (rowIndex < state.currentRow) {
      const evaluation = state.evaluations[rowIndex];
      if (evaluation && state.revealedLetters[rowIndex][index]) {
        classes.push(evaluation[index]);
        classes.push('flip');
      }
    }
    if (rowIndex === state.currentRow && state.evaluations[rowIndex] && state.revealedLetters[rowIndex][index]) {
      classes.push(state.evaluations[rowIndex][index]);
      classes.push('flip');
    }
    if (rowIndex === state.revealedAnswerRow) {
      classes.push('revealed-answer');
    }
    return classes.join(' ');
  };

  const getFlipDelay = (index) => ({
    '--flip-delay': `${index * 200}ms`
  });

  

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        dispatch({ type: 'SET_MENU_OPEN', menuOpen: false });
      }
    };
    if (state.menuOpen) {
      document.addEventListener('mousedown', handleClick);
    } else {
      document.removeEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [state.menuOpen]);

  const revealAnswer = async () => {
    if (state.gameOver) return;
    let revealRow = state.guesses.findIndex(g => g === '');
    if (revealRow === -1) revealRow = state.guesses.length - 1;
    dispatch({ type: 'SET_REVEALED_ANSWER_ROW', revealedAnswerRow: revealRow });
    const answer = state.targetWord;
    if (!answer || !answer.length) return;
    const evaluation = evaluateGuess(answer, state.targetWord);
    const newGuesses = [...state.guesses];
    const newEvaluations = [...state.evaluations];
    newGuesses[revealRow] = answer;
    newEvaluations[revealRow] = evaluation;
    dispatch({ type: 'SET_GUESSES', guesses: newGuesses });
    dispatch({ type: 'SET_EVALUATIONS', evaluations: newEvaluations });
    dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: '' });
    dispatch({ type: 'SET_REVEALED_LETTERS', revealedLetters: state.revealedLetters.map((arr, idx) => idx === revealRow ? Array(state.wordLength).fill(false) : [...arr]) });
    revealRowLetters(revealRow);
    const newLetterStates = { ...state.letterStates };
    for (let i = 0; i < answer.length; i++) {
      const letter = answer[i];
      newLetterStates[letter] = evaluation[i];
    }
    dispatch({ type: 'SET_LETTER_STATES', letterStates: newLetterStates });
    setTimeout(async () => {
      dispatch({ type: 'SET_GAME_OVER', gameOver: true });
      dispatch({ type: 'SET_IS_SUCCESS', isSuccess: true });
      dispatch({ type: 'SET_COMPLETED_WORD', completedWord: state.targetWord });
      try {
        const def = await getWordDefinition(state.targetWord);
        dispatch({ type: 'SET_WORD_DEFINITION', wordDefinition: def });
        dispatch({ type: 'SET_SHOW_MODAL', showModal: true });
      } catch (error) {
        dispatch({ type: 'SET_SHOW_MODAL', showModal: true });
      }
    }, 5 * 200 + 200);
    dispatch({ type: 'SET_MENU_OPEN', menuOpen: false });
  };

  const getClue = useCallback(async () => {
    if (state.targetWord) {
      try {
        const def = await getWordDefinition(state.targetWord);
        dispatch({ type: 'SET_CLUE', clue: def.definitions[0]?.definition || 'No clue available' });
        dispatch({ type: 'SET_SHOW_CLUE', showClue: true });
      } catch (error) {
        console.error('Error fetching clue:', error);
        dispatch({ type: 'SET_CLUE', clue: 'No clue available' });
        dispatch({ type: 'SET_SHOW_CLUE', showClue: true });
      }
    }
  }, [state.targetWord]);

  const handleShowSuggestions = useCallback(async () => {
    dispatch({ type: 'SET_IS_LOADING', isLoading: true });
    const wordLength = state.wordLength;
    const correct = Array(wordLength).fill(null);
    const wrongPosition = new Set();
    const present = new Set();
    const absent = new Set();
    for (let row = 0; row < state.evaluations.length; row++) {
      const evalRow = state.evaluations[row];
      const guess = state.guesses[row] || '';
      if (!evalRow) continue;
      for (let i = 0; i < wordLength; i++) {
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
    const words = await getWordFinderSuggestions(correct, present, absent, wordLength, state.targetWord, wrongPosition);
    const availableWords = words.filter(word => !state.usedSuggestions.includes(word));
    dispatch({ type: 'SET_IS_LOADING', isLoading: false });
    if (availableWords.length > 0) {
      const newSuggestion = availableWords[Math.floor(Math.random() * availableWords.length)];
      dispatch({ type: 'SET_USED_SUGGESTIONS', usedSuggestions: [...state.usedSuggestions, newSuggestion] });
      dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: newSuggestion });
      dispatch({ type: 'SET_PENDING_SUGGESTION', pendingSuggestion: true });
    } else {
      dispatch({ type: 'SET_IS_LOADING', isLoading: true });
      const newWords = await getDictionaryWords(wordLength);
      const newAvailableWords = newWords.filter(word => !state.usedSuggestions.includes(word));
      dispatch({ type: 'SET_IS_LOADING', isLoading: false });
      if (newAvailableWords.length > 0) {
        const newSuggestion = newAvailableWords[Math.floor(Math.random() * newAvailableWords.length)];
        dispatch({ type: 'SET_USED_SUGGESTIONS', usedSuggestions: [...state.usedSuggestions, newSuggestion] });
        dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: newSuggestion });
        dispatch({ type: 'SET_PENDING_SUGGESTION', pendingSuggestion: true });
      } else {
        showMessage('No new suggestions found');
      }
    }
  }, [state.evaluations, state.guesses, state.usedSuggestions, state.targetWord, state.wordLength]);

  useEffect(() => {
    if (state.pendingSuggestion && state.currentGuess.length === state.wordLength) {
      dispatch({ type: 'SET_PENDING_SUGGESTION', pendingSuggestion: false });
      submitGuess();
    }
    // eslint-disable-next-line
  }, [state.pendingSuggestion, state.currentGuess, state.wordLength]);

  // Defensive: Only calculate absentLetters if targetWord is a valid string
  const absentLetters =
    typeof state.targetWord === 'string' && Array.isArray(state.guesses)
      ? Array.from(
          new Set(
            state.guesses
              .join('')
              .split('')
              .filter(l => l && !state.targetWord.includes(l))
          )
        )
      : [];

  useEffect(() => {
    const handleMenuShortcuts = (e) => {
      if (e.altKey && e.shiftKey && !e.ctrlKey) {
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          if (!state.showClue) getClue();
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
  }, [state.showClue, getClue, handleShowSuggestions]);

  // animateStreak/animateScore effects removed

  // Speech recognition for microphone input
  const recognizingRef = useRef(false);
  const recognitionRef = useRef(null);

  const handleMicInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showMessage('Speech recognition not supported in this browser.');
      return;
    }
    if (recognizingRef.current) {
      recognitionRef.current && recognitionRef.current.stop();
      recognizingRef.current = false;
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let timeoutId;
    recognition.onstart = () => {
      recognizingRef.current = true;
      showMessage('Listening...');
      // Stop after 7 seconds if no speech
      timeoutId = setTimeout(() => {
        if (recognizingRef.current) {
          recognition.stop();
          showMessage('No speech detected.');
        }
      }, 7000);
    };
    recognition.onerror = (event) => {
      recognizingRef.current = false;
      clearTimeout(timeoutId);
      let errMsg = 'Speech recognition error.';
      if (event && event.error) {
        if (event.error === 'not-allowed') errMsg = 'Microphone access denied.';
        else if (event.error === 'no-speech') errMsg = 'No speech detected.';
        else if (event.error === 'audio-capture') errMsg = 'No microphone found.';
        else errMsg = `Speech recognition error: ${event.error}`;
      }
      showMessage(errMsg);
    };
    recognition.onend = () => {
      recognizingRef.current = false;
      clearTimeout(timeoutId);
    };
    recognition.onresult = (event) => {
      recognizingRef.current = false;
      clearTimeout(timeoutId);
      const transcript = event.results[0][0].transcript.trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (transcript.length !== 5) {
        showMessage('Please say a 5-letter word.');
        return;
      }
      dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: transcript });
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className={`wordle ${state.isContrastMode ? 'contrast' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        value={state.currentGuess}
        maxLength={state.wordLength}
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
        readOnly
      />
      <div className="game-header">
        {/* score-streak-container removed */}
        <div className="header-content">
          <h1><Logo /></h1>
        </div>
        <div className="header-actions">
          
          <button
            onClick={handleShowSuggestions}
            className="header-icon-btn"
            title="Suggest Word (Alt+Shift+S)"
            aria-label="Suggest Word"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
              <path d="M0 0h24v24H0V0z" fill="none"/>
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </button>
          <button
            onClick={handleMicInput}
            className="header-icon-btn"
            title="Speak Word (Microphone)"
            aria-label="Speak Word"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
              <path d="M0 0h24v24H0V0z" fill="none"/>
              <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3s-3 1.34-3 3v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.07 2.13 5.64 5 6.32V21h2v-2.68c2.87-.68 5-3.25 5-6.32h-2z"/>
            </svg>
          </button>
          <div className="burger-menu-anchor">
            <button
              className={`burger-menu-btn ${state.menuOpen ? 'open' : ''}`}
              aria-label="Open menu"
              onClick={() => dispatch({ type: 'SET_MENU_OPEN', menuOpen: !state.menuOpen })}
            >
              <span className="burger-bar"></span>
              <span className="burger-bar"></span>
              <span className="burger-bar"></span>
            </button>
            {state.menuOpen && (
              <div className="burger-dropdown" ref={menuRef}>
                <button onClick={() => { startNewGame(3); dispatch({ type: 'SET_MENU_OPEN', menuOpen: false }); }} className="dropdown-item">New Game</button>
                <button onClick={() => { revealAnswer(); dispatch({ type: 'SET_MENU_OPEN', menuOpen: false }); }} className="dropdown-item">Reveal</button>
                <button onClick={() => dispatch({ type: 'SET_IS_CONTRAST_MODE', isContrastMode: !state.isContrastMode })} className="dropdown-item">Contrast Mode</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {state.message && (
        <div className="message" style={{ position: 'relative', zIndex: 10, margin: '12px 0', fontWeight: 'bold', color: '#b91c1c', background: '#fffbe6', border: '1px solid #fbbf24', borderRadius: 6, padding: '8px 16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          {state.message}
        </div>
      )}
      {state.isLoading && <div className="loading">Loading words...</div>}
      <div className="game-container">
        <div className="wordle-grid">
          {state.guesses.map((guess, rowIndex) => {
            return (
              <div
                key={rowIndex}
                className="wordle-row"
                style={{
                  '--wordle-row-columns': `repeat(${state.wordLength}, 1fr)`,
                  '--tile-size': `min(60px, max(32px, calc(60vw / ${state.wordLength})))`
                }}
              >
                {Array.from({ length: state.wordLength }, (_, index) => {
                  let letter = '';
                  if (rowIndex === state.revealedAnswerRow) {
                    letter = (state.targetWord && typeof state.targetWord === 'string' && state.targetWord.length > index)
                      ? state.targetWord[index]
                      : '';
                  } else if (rowIndex === state.currentRow) {
                    letter = state.currentGuess[index] || '';
                  } else {
                    letter = state.guesses[rowIndex][index] || '';
                  }
                  // Only allow clicking for previous guesses (not current row or empty)
                  const isClickable = rowIndex < state.currentRow && state.guesses[rowIndex];
                  return (
                    <div
                      key={index}
                      className={`wordle-tile ${getTileClass(guess[index], index, rowIndex)}${rowIndex === state.currentRow && state.invalidGuess ? ' invalid' : ''} ${isClickable ? 'clickable-tile' : ''}`}
                      style={getFlipDelay(index)}
                      onClick={isClickable ? () => handleShowDefinition(state.guesses[rowIndex]) : undefined}
                      title={isClickable ? `Show definition for ${state.guesses[rowIndex]}` : undefined}
                      tabIndex={isClickable ? 0 : -1}
                      role={isClickable ? 'button' : undefined}
                      aria-label={isClickable ? `Show definition for ${state.guesses[rowIndex]}` : undefined}
                    >
                      {letter}
                      {/* Mark all letters in red if invalid guess on current row */}
                      {rowIndex === state.currentRow && state.invalidGuess && letter && (
                        <span style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: 0,
                          bottom: 0,
                          color: '#b91c1c',
                          fontWeight: 'bold',
                          background: 'rgba(255,0,0,0.08)',
                          zIndex: 2
                        }}>{letter}</span>
                      )}
                      {state.isContrastMode && state.evaluations[rowIndex] && state.revealedLetters[rowIndex][index] && (
                        <div className="contrast-icon">
                          {state.evaluations[rowIndex][index] === 'correct' && (
                            <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor">
                              <path d="M0 0h24v24H0V0z" fill="none"/>
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                            </svg>
                          )}
                          {state.evaluations[rowIndex][index] === 'wrong-position' && (
                            <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor">
                              <path d="M0 0h24v24H0V0z" fill="none"/>
                              <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* rowScores display removed */}
              </div>
            );
          })}
        </div>
        {state.clue && (
          <div className="clue-text" style={{marginBottom: 8, color: '#1a73e8', fontStyle: 'italic'}}>
            {state.clue} <span style={{color:'#555', fontStyle:'normal'}}>({state.wordLength})</span>
          </div>
        )}
        <div className="keyboard">
          {[
            'QWERTYUIOP',
            'ASDFGHJKL',
            'ZXCVBNM',
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
                  className={`key ${state.letterStates[key] || ''}`}
                  onClick={() => handleKeyPress(key)}
                  data-key={key}
                >
                  {key}
                  {state.isContrastMode && state.letterStates[key] && (
                    <div className="contrast-icon">
                      {state.letterStates[key] === 'correct' && (
                        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor">
                          <path d="M0 0h24v24H0V0z" fill="none"/>
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                      )}
                      {state.letterStates[key] === 'wrong-position' && (
                        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor">
                          <path d="M0 0h24v24H0V0z" fill="none"/>
                          <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
                        </svg>
                      )}
                    </div>
                  )}
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
      </div>
      <WordModal
        isOpen={state.showModal}
        onClose={() => dispatch({ type: 'SET_SHOW_MODAL', showModal: false })}
        word={state.completedWord}
        definition={state.wordDefinition}
        isSuccess={state.isSuccess}
        onNextWord={handleNextWord}
      />
      <DefinitionModal
        isOpen={state.showDefinitionModal}
        onClose={() => dispatch({ type: 'SET_SHOW_DEFINITION_MODAL', showDefinitionModal: false })}
        word={state.definitionModalWord}
        definition={state.definitionModalDefinition}
      />
    </div>
  );
};

export default Wordle;