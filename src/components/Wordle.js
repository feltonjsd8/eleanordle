import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import '../styles/Wordle.css';
import { getRandomWord, getWordDefinition, isValidWord, getDictionaryWords } from '../services/dictionaryService';
import WordModal from './WordModal';
import DefinitionModal from './DefinitionModal';
import { getSuggestions } from '../services/suggestionService';
import Logo from './Logo';

const initialState = {
  guesses: Array(6).fill(''),
  currentGuess: '',
  currentRow: 0,
  targetWord: '',
  gameOver: false,
  message: '',
  letterStates: {},
  evaluations: Array(6).fill(null),
  revealedLetters: Array(6).fill(null).map(() => Array(5).fill(false)),
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
  streak: 0,
  score: 50,
          totalScore: 0,
          rowScores: Array(6).fill(null),
          wrongPositionHistory: {},
animateScore: false,
animateStreak: false,
        };;

function reducer(state, action) {
  switch (action.type) {
    case 'RESET': {
      const alwaysShowClue = state.alwaysShowClue;
      const resetStreak = action.resetStreak;
      return {
        ...initialState,
        targetWord: action.targetWord,
        alwaysShowClue,
        showClue: alwaysShowClue ? true : false,
        streak: resetStreak ? 0 : (action.keepStreak ? state.streak : 0),
        totalScore: resetStreak ? 0 : state.totalScore,
        score: 50,
      };
    }
    case 'DECREMENT_SCORE':
      return { ...state, score: Math.max(0, state.score - action.amount) };
    case 'INCREMENT_STREAK':
      return { ...state, streak: state.streak + 1 };
    case 'RESET_STREAK':
      return { ...state, streak: 0 };
    case 'ADD_TO_TOTAL_SCORE':
      return { ...state, totalScore: state.totalScore + state.score };
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
    case 'SET_ROW_SCORES':
      return { ...state, rowScores: action.rowScores };
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
    case 'SET_ANIMATE_SCORE':
      return { ...state, animateScore: action.animateScore };
    case 'SET_ANIMATE_STREAK':
      return { ...state, animateStreak: action.animateStreak };
    default:
      return state;
  }
}

const Wordle = ({ onBackToMenu }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const inputRef = useRef();
  const menuRef = useRef();
  // Cache for word definitions to avoid unnecessary API calls
  const definitionCache = useRef({});

  const startNewGame = async (resetStreak = false, animate = false) => {
    if (animate) {
      dispatch({ type: 'SET_ANIMATE_SCORE', animateScore: true });
      dispatch({ type: 'SET_ANIMATE_STREAK', animateStreak: true });
    }
    dispatch({ type: 'SET_IS_LOADING', isLoading: true });
    try {
      const newWord = await getRandomWord();
      dispatch({ type: 'RESET', targetWord: newWord, keepStreak: !resetStreak, resetStreak });
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
    startNewGame(false, false);
    // eslint-disable-next-line
  }, []);

  const handleKeyPress = (key) => {
    if (state.gameOver) return;

    if (key === 'ENTER') {
      if (state.currentGuess.length !== 5) {
        showMessage('Word must be 5 letters');
        return;
      }
      submitGuess();
    } else if (key === 'BACKSPACE') {
      const newGuess = state.currentGuess.slice(0, -1);
      if (state.invalidGuess && newGuess.length < 5) dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: false });
      dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: newGuess });
    } else if (state.currentGuess.length < 5) {
      if (/^[A-Z]$/.test(key)) {
        const newGuess = state.currentGuess + key;
        if (state.invalidGuess && newGuess.length < 5) dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: false });
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
    if (state.currentGuess.length === 5) {
      (async () => {
        const isValid = await isValidWord(state.currentGuess);
        dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: !isValid });
      })();
    } else if (state.invalidGuess && state.currentGuess.length < 5) {
      dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: false });
    }
  }, [state.currentGuess]);

  const evaluateGuess = (guess, target) => {
    const evaluation = Array(5).fill('incorrect');
    const targetLetters = target.split('');
    const guessLetters = guess.split('');
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        evaluation[i] = 'correct';
        targetLetters[i] = null;
        guessLetters[i] = null;
      }
    }
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
    if (state.isSuccess) {
      dispatch({ type: 'INCREMENT_STREAK' });
      dispatch({ type: 'ADD_TO_TOTAL_SCORE' });
      dispatch({ type: 'SET_ANIMATE_SCORE', animateScore: true });
    }
    dispatch({ type: 'SET_SHOW_MODAL', showModal: false });
    // Only reset streak/score if last game was a loss (not success)
    await startNewGame(!state.isSuccess, state.isSuccess);
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
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        dispatch({ type: 'REVEAL_LETTER', rowIndex, letterIndex: i });
      }, i * 200);
    }
  };

  const submitGuess = async () => {
    const isValid = await isValidWord(state.currentGuess);
    if (!isValid) {
      return;
    }
    const evaluation = evaluateGuess(state.currentGuess, state.targetWord);
    const newRowScores = [...state.rowScores];
    let score_reduction = 0;
    const newLetterStates = { ...state.letterStates }; // Get current letter states
    const newWrongPositionHistory = JSON.parse(JSON.stringify(state.wrongPositionHistory || {}));

    if (state.currentGuess !== state.targetWord) {
      for (let i = 0; i < evaluation.length; i++) {
        const letter = state.currentGuess[i];
        const currentOverallState = newLetterStates[letter];
        let score = 0;

        if (evaluation[i] === 'correct') {
          if (currentOverallState !== 'correct') {
            score = 5;
          }
        } else if (evaluation[i] === 'wrong-position') {
          const history = newWrongPositionHistory[letter] || [];
          if (!history.includes(i)) {
            score = 3;
            if (!newWrongPositionHistory[letter]) {
              newWrongPositionHistory[letter] = [];
            }
            newWrongPositionHistory[letter].push(i);
          }
        } else if (evaluation[i] === 'incorrect') {
          if (currentOverallState !== 'correct' && currentOverallState !== 'wrong-position' && currentOverallState !== 'incorrect') {
            score = 1;
          }
        }
        score_reduction += score;
      }
    }
    newRowScores[state.currentRow] = state.score - score_reduction;
    dispatch({ type: 'SET_ROW_SCORES', rowScores: newRowScores });
    dispatch({ type: 'DECREMENT_SCORE', amount: score_reduction });
    dispatch({ type: 'SET_WRONG_POSITION_HISTORY', wrongPositionHistory: newWrongPositionHistory });
    const newEvaluations = [...state.evaluations];
    newEvaluations[state.currentRow] = evaluation;
    dispatch({ type: 'SET_EVALUATIONS', evaluations: newEvaluations });
    const newGuesses = [...state.guesses];
    newGuesses[state.currentRow] = state.currentGuess;
    dispatch({ type: 'SET_GUESSES', guesses: newGuesses });
    // Always create a new revealedLetters array for the row
    dispatch({ type: 'SET_REVEALED_LETTERS', revealedLetters: state.revealedLetters.map((arr, idx) => idx === state.currentRow ? Array(5).fill(false) : arr.slice()) });
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
        dispatch({ type: 'RESET_STREAK' });
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

  const showMessage = (msg) => {
    dispatch({ type: 'SET_MESSAGE', message: msg });
    setTimeout(() => dispatch({ type: 'SET_MESSAGE', message: '' }), 2000);
  };

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
    const evaluation = evaluateGuess(answer, state.targetWord);
    const newGuesses = [...state.guesses];
    const newEvaluations = [...state.evaluations];
    newGuesses[revealRow] = answer;
    newEvaluations[revealRow] = evaluation;
    dispatch({ type: 'SET_GUESSES', guesses: newGuesses });
    dispatch({ type: 'SET_EVALUATIONS', evaluations: newEvaluations });
    dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: '' });
    dispatch({ type: 'SET_REVEALED_LETTERS', revealedLetters: state.revealedLetters.map((arr, idx) => idx === revealRow ? Array(5).fill(false) : [...arr]) });
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
    const correct = Array(5).fill(null);
    const wrongPosition = new Set();
    const present = new Set();
    const absent = new Set();
    for (let row = 0; row < state.evaluations.length; row++) {
      const evalRow = state.evaluations[row];
      const guess = state.guesses[row] || '';
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
    const words = await getWordFinderSuggestions(correct, present, absent, state.targetWord, wrongPosition);
    const availableWords = words.filter(word => !state.usedSuggestions.includes(word));
    dispatch({ type: 'SET_IS_LOADING', isLoading: false });
    if (availableWords.length > 0) {
      const newSuggestion = availableWords[Math.floor(Math.random() * availableWords.length)];
      dispatch({ type: 'SET_USED_SUGGESTIONS', usedSuggestions: [...state.usedSuggestions, newSuggestion] });
      dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: newSuggestion });
      dispatch({ type: 'SET_PENDING_SUGGESTION', pendingSuggestion: true });
    } else {
      dispatch({ type: 'SET_IS_LOADING', isLoading: true });
      const newWords = await getDictionaryWords();
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
  }, [state.evaluations, state.guesses, state.usedSuggestions, state.targetWord]);

  useEffect(() => {
    if (state.pendingSuggestion && state.currentGuess.length === 5) {
      dispatch({ type: 'SET_PENDING_SUGGESTION', pendingSuggestion: false });
      submitGuess();
    }
    // eslint-disable-next-line
  }, [state.pendingSuggestion, state.currentGuess]);

  const absentLetters = Array.from(new Set(
    state.guesses
      .join('')
      .split('')
      .filter(l => l && !state.targetWord.includes(l))
  ));

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

  useEffect(() => {
    if (state.animateStreak) {
      const timer = setTimeout(() => dispatch({ type: 'SET_ANIMATE_STREAK', animateStreak: false }), 500);
      return () => clearTimeout(timer);
    }
  }, [state.animateStreak]);

  useEffect(() => {
    if (state.animateScore) {
      const timer = setTimeout(() => dispatch({ type: 'SET_ANIMATE_SCORE', animateScore: false }), 500);
      return () => clearTimeout(timer);
    }
  }, [state.animateScore]);

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
        readOnly
      />
      <div className="game-header">
        <div className="score-streak-container">
          <div className={`streak-display ${state.animateStreak ? 'animate' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-fire" viewBox="0 0 16 16">
              <path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16m0-1c-1.657 0-3-1-3-2.75 0-.75.25-2 1.25-3C6.125 10 7 10.5 7 10.5c-.375-1.25.5-3.25 2-3.5-.179 1-.25 2 1 3 .625.5 1 1.364 1 2.25C11 14 9.657 15 8 15"/>
            </svg>
            <span>{state.streak}</span>
          </div>
          <div className={`score-display ${state.animateScore ? 'animate' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z"/>
            </svg>
            <span>{state.totalScore}</span>
          </div>
        </div>
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
                <button onClick={() => { startNewGame(true); dispatch({ type: 'SET_MENU_OPEN', menuOpen: false }); }} className="dropdown-item">New Game</button>
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
            let showDefinitionIcon = false;
            if (rowIndex < state.currentRow && state.guesses[rowIndex]) {
              const cached = definitionCache.current[state.guesses[rowIndex]];
              if (
                cached &&
                Array.isArray(cached.definitions) &&
                cached.definitions[0]?.definition &&
                cached.definitions[0].definition !== 'Definition not available'
              ) {
                // Only show icon if a real definition is cached
                showDefinitionIcon = true;
              } else {
                showDefinitionIcon = false;
              }
            }
            return (
              <div key={rowIndex} className="wordle-row">
                {rowIndex < state.currentRow && state.guesses[rowIndex] && showDefinitionIcon && (
                  <button
                    className="definition-icon-btn"
                    onClick={() => handleShowDefinition(state.guesses[rowIndex])}
                    title={`View definition of ${state.guesses[rowIndex]}`}
                    aria-label={`View definition of ${state.guesses[rowIndex]}`}
                  >
                    {/* Open Book icon from Wikimedia Commons, CC0 */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M2 6.5C2 5.12 3.12 4 4.5 4H19.5C20.88 4 22 5.12 22 6.5V19.5C22 20.33 21.33 21 20.5 21C17.46 21 14.42 20.5 12 19.5C9.58 20.5 6.54 21 3.5 21C2.67 21 2 20.33 2 19.5V6.5ZM4.5 6C4.22 6 4 6.22 4 6.5V18.5C6.97 18.5 9.97 18.03 12 17.13C14.03 18.03 17.03 18.5 20 18.5V6.5C20 6.22 19.78 6 19.5 6H4.5Z" fill="#111"/>
                    </svg>
                  </button>
                )}
                {Array.from({ length: 5 }, (_, index) => (
                  <div
                    key={index}
                    className={`wordle-tile ${getTileClass(guess[index], index, rowIndex)}${rowIndex === state.currentRow && state.invalidGuess ? ' invalid' : ''}`}
                    style={getFlipDelay(index)}
                  >
                    {rowIndex === state.revealedAnswerRow ? state.targetWord[index] : (rowIndex === state.currentRow ? state.currentGuess[index] || '' : state.guesses[rowIndex][index] || '')}
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
                ))}
                {state.rowScores[rowIndex] !== null && (
                  <div className="row-score">
                    {state.rowScores[rowIndex]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {state.showClue && state.clue && (
          <div className="clue-text" style={{marginBottom: 8, color: '#1a73e8', fontStyle: 'italic'}}>
            {state.clue}
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