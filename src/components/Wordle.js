import React, { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import '../styles/Wordle.css';
import {
  getRandomWord,
  getWordDefinition,
  isValidWord,
  getDictionaryWords,
  getDailyWordRecord,
  getDailyLadderWords,
} from '../services/dictionaryService';
import { loadStats, recordGameResult } from '../services/statsService';
import { maskWordInText } from '../services/textMasking';
import WordModal from './WordModal';
import DefinitionModal from './DefinitionModal';
import TutorialModal from './TutorialModal';
import Logo from './Logo';

const GAME_MODE_DAILY = 'daily';
const GAME_MODE_PRACTICE = 'practice';
const GAME_MODE_LADDER = 'ladder';
const GAME_MODE_DAILY_LADDER = 'daily-ladder';
const MAX_GUESSES = 6;
const DEFAULT_WORD_LENGTH = 5;
const LADDER_WORD_LENGTHS = [4, 5, 6];
const MODAL_VARIANT_RESULT = 'result';
const MODAL_VARIANT_LADDER_STAGE = 'ladder-stage';
const DAILY_STORAGE_MIGRATION_KEY = 'eleanordle:migration:daily-cleanup-v1';

const createBoardState = (wordLength = DEFAULT_WORD_LENGTH) => ({
  guesses: Array(MAX_GUESSES).fill(''),
  evaluations: Array(MAX_GUESSES).fill(null),
  revealedLetters: Array(MAX_GUESSES).fill(null).map(() => Array(wordLength).fill(false)),
  rowScores: Array(MAX_GUESSES).fill(null),
});

const getModeLabel = (mode) => {
  if (mode === GAME_MODE_DAILY) return 'DAILY';
  if (mode === GAME_MODE_DAILY_LADDER) return 'DAILY';
  if (mode === GAME_MODE_LADDER) return 'LADDER';
  return 'INFINITE';
};

const getDailyStoragePrefix = (mode, dateKey) => `eleanordle:${mode}:${dateKey}`;
const getDailyTargetStorageKey = (mode, dateKey) => `${getDailyStoragePrefix(mode, dateKey)}:targetWord`;
const getDailyClueStorageKey = (mode, dateKey) => `${getDailyStoragePrefix(mode, dateKey)}:clue`;
const getDailyStateStorageKey = (mode, dateKey) => `${getDailyStoragePrefix(mode, dateKey)}:state`;
const getDailyLadderWordsStorageKey = (dateKey) => `${getDailyStoragePrefix(GAME_MODE_DAILY_LADDER, dateKey)}:words`;

const isDailyMode = (mode) => mode === GAME_MODE_DAILY || mode === GAME_MODE_DAILY_LADDER;

const isLadderMode = (mode) => mode === GAME_MODE_LADDER || mode === GAME_MODE_DAILY_LADDER;

const getLocalDateKey = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hashToUint32 = (str) => {
  // FNV-1a (32-bit)
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const getClueForDaily = (definitions, dateKey, word) => {
  // Deterministically select a normalized definition so API ordering differences do not matter.
  if (!definitions || definitions.length === 0) {
    return 'No clue available';
  }

  const normalized = Array.from(
    new Set(
      definitions
        .map((entry) => (entry?.definition || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  if (normalized.length === 0) return 'No clue available';

  const seed = hashToUint32(`${dateKey}:${word}`);
  const idx = seed % normalized.length;
  return maskWordInText(normalized[idx], word);
};

const buildShareText = ({ dateKey, evaluations, isSuccess }) => {
  const playedRows = evaluations.filter(Boolean).length;
  const result = isSuccess ? playedRows : 'X';
  const lines = evaluations
    .filter(Boolean)
    .map((row) =>
      row
        .map((cell) => {
          if (cell === 'correct') return '🟩';
          if (cell === 'wrong-position') return '🟨';
          return '⬛';
        })
        .join('')
    )
    .join('\n');

  return `Eleanordle Daily ${dateKey} ${result}/6\n\n${lines}`;
};

const computeLetterStatesFromHistory = (guesses, evaluations) => {
  const states = {};
  for (let r = 0; r < evaluations.length; r++) {
    const rowEval = evaluations[r];
    const guess = guesses[r] || '';
    if (!rowEval) continue;
    for (let i = 0; i < rowEval.length; i++) {
      const letter = guess[i];
      if (!letter) continue;
      const newState = rowEval[i];
      const current = states[letter];
      if (newState === 'correct') states[letter] = 'correct';
      else if (newState === 'wrong-position') {
        if (current !== 'correct' && current !== 'wrong-position') states[letter] = 'wrong-position';
      } else if (newState === 'incorrect') {
        if (!current) states[letter] = 'incorrect';
      }
    }
  }
  return states;
};

const evaluateGuess = (guess, target) => {
  const evaluation = Array(target.length).fill('incorrect');
  const targetLetters = target.split('');
  const guessLetters = guess.split('');
  for (let i = 0; i < target.length; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      evaluation[i] = 'correct';
      targetLetters[i] = null;
      guessLetters[i] = null;
    }
  }
  for (let i = 0; i < target.length; i++) {
    if (guessLetters[i] === null) continue;
    const targetIndex = targetLetters.indexOf(guessLetters[i]);
    if (targetIndex !== -1) {
      evaluation[i] = 'wrong-position';
      targetLetters[targetIndex] = null;
    }
  }
  return evaluation;
};

const initialState = {
  ...createBoardState(DEFAULT_WORD_LENGTH),
  currentGuess: '',
  currentRow: 0,
  targetWord: '',
  activeWordLength: DEFAULT_WORD_LENGTH,
  gameOver: false,
  message: '',
  letterStates: {},
  isLoading: false,
  showModal: false,
  modalVariant: MODAL_VARIANT_RESULT,
  modalTitle: '',
  modalActionLabel: '',
  modalProgressLabel: '',
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
  get isDarkMode() {
    try {
      return localStorage.getItem('darkMode') === 'true';
    } catch (e) {
      return false;
    }
  },
  alwaysShowClue: true,
  streak: 0,
  score: 50,
  totalScore: 0,
  wrongPositionHistory: {},
  gameMode: GAME_MODE_DAILY,
  dailyDateKey: getLocalDateKey(),
  ladderWords: [],
  ladderStageIndex: 0,
  ladderCompletedStages: [],
  ladderGuessCounts: [],
  ladderTotalGuesses: 0,
  animateScore: false,
  animateStreak: false,
  stats: null,
  micEnabled: false,
  showTutorial: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'RESET': {
      const alwaysShowClue = state.alwaysShowClue;
      const resetStreak = action.resetStreak;
      const wordLength = action.wordLength || action.targetWord?.length || DEFAULT_WORD_LENGTH;
      const boardState = createBoardState(wordLength);
      return {
        ...initialState,
        ...boardState,
        targetWord: action.targetWord,
        activeWordLength: wordLength,
        alwaysShowClue,
        showClue: alwaysShowClue ? true : false,
        streak: resetStreak ? 0 : (action.keepStreak ? state.streak : 0),
        totalScore: resetStreak ? 0 : state.totalScore,
        score: 50,
        isDarkMode: state.isDarkMode,
        isContrastMode: state.isContrastMode,
        micEnabled: state.micEnabled,
        showTutorial: state.showTutorial,
        stats: action.stats || state.stats,
        gameMode: action.gameMode || state.gameMode,
        dailyDateKey: action.dailyDateKey || state.dailyDateKey,
        ladderWords: action.ladderWords || [],
        ladderStageIndex: action.ladderStageIndex || 0,
        ladderCompletedStages: action.ladderCompletedStages || [],
        ladderGuessCounts: action.ladderGuessCounts || [],
        ladderTotalGuesses: action.ladderTotalGuesses || 0,
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
    case 'APPEND_CURRENT_GUESS': {
      if (state.currentGuess.length >= state.activeWordLength) {
        return state;
      }
      return {
        ...state,
        currentGuess: `${state.currentGuess}${action.key}`,
        invalidGuess: false,
      };
    }
    case 'REMOVE_LAST_CURRENT_GUESS':
      return {
        ...state,
        currentGuess: state.currentGuess.slice(0, -1),
        invalidGuess: false,
      };
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
    case 'SET_MODAL_VARIANT':
      return { ...state, modalVariant: action.modalVariant };
    case 'SET_MODAL_TITLE':
      return { ...state, modalTitle: action.modalTitle };
    case 'SET_MODAL_ACTION_LABEL':
      return { ...state, modalActionLabel: action.modalActionLabel };
    case 'SET_MODAL_PROGRESS_LABEL':
      return { ...state, modalProgressLabel: action.modalProgressLabel };
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
    case 'SET_IS_DARK_MODE':
      return { ...state, isDarkMode: action.isDarkMode };
    case 'SET_TARGET_WORD':
      return { ...state, targetWord: action.targetWord };
    case 'SET_ACTIVE_WORD_LENGTH':
      return { ...state, activeWordLength: action.activeWordLength };
    case 'SET_ALWAYS_SHOW_CLUE':
      return { ...state, alwaysShowClue: action.alwaysShowClue };
    case 'SET_ROW_SCORES':
      return { ...state, rowScores: action.rowScores };
    case 'SET_WRONG_POSITION_HISTORY':
      return { ...state, wrongPositionHistory: action.wrongPositionHistory };
    case 'SET_GAME_MODE':
      return { ...state, gameMode: action.gameMode };
    case 'SET_DAILY_DATE_KEY':
      return { ...state, dailyDateKey: action.dailyDateKey };
    case 'SET_LADDER_WORDS':
      return { ...state, ladderWords: action.ladderWords };
    case 'SET_LADDER_STAGE_INDEX':
      return { ...state, ladderStageIndex: action.ladderStageIndex };
    case 'SET_LADDER_COMPLETED_STAGES':
      return { ...state, ladderCompletedStages: action.ladderCompletedStages };
    case 'SET_LADDER_GUESS_COUNTS':
      return { ...state, ladderGuessCounts: action.ladderGuessCounts };
    case 'SET_LADDER_TOTAL_GUESSES':
      return { ...state, ladderTotalGuesses: action.ladderTotalGuesses };
    case 'LOAD_SAVED_GAME': {
      // Intentionally keep user prefs (dark/contrast) and cached UI flags.
      const preserved = {
        isDarkMode: state.isDarkMode,
        isContrastMode: state.isContrastMode,
        alwaysShowClue: state.alwaysShowClue,
      };
      return {
        ...state,
        ...action.saved,
        ...preserved,
        showModal: false,
        showDefinitionModal: false,
        menuOpen: false,
        invalidGuess: false,
        pendingSuggestion: false,
        modalVariant: MODAL_VARIANT_RESULT,
        modalTitle: '',
        modalActionLabel: '',
        modalProgressLabel: '',
      };
    }
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
    case 'SET_STATS':
      return { ...state, stats: action.stats };
    case 'SET_MIC_ENABLED':
      return { ...state, micEnabled: action.micEnabled };
    case 'SET_SHOW_TUTORIAL':
      return { ...state, showTutorial: action.showTutorial };
    default:
      return state;
  }
}

const Wordle = ({ onBackToMenu }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [dailyMenuOpen, setDailyMenuOpen] = useState(false);
  const [infiniteMenuOpen, setInfiniteMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const inputRef = useRef();
  const menuRef = useRef();
  // Cache for word definitions to avoid unnecessary API calls
  const definitionCache = useRef({});

  const closeMenu = useCallback(() => {
    dispatch({ type: 'SET_MENU_OPEN', menuOpen: false });
    setDailyMenuOpen(false);
    setInfiniteMenuOpen(false);
    setOptionsMenuOpen(false);
  }, []);

  const refocusGameInput = useCallback(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== inputRef.current) {
      activeElement.blur();
    }
    if (inputRef.current && typeof inputRef.current.focus === 'function') {
      inputRef.current.focus({ preventScroll: true });
    }
  }, []);

  const preventButtonFocus = useCallback((event) => {
    event.preventDefault();
  }, []);

  const runDailyStorageCleanupMigration = useCallback(() => {
    try {
      if (localStorage.getItem(DAILY_STORAGE_MIGRATION_KEY) === 'done') return;

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('eleanordle:daily:')) {
          localStorage.removeItem(key);
        }
      }

      localStorage.setItem(DAILY_STORAGE_MIGRATION_KEY, 'done');
    } catch (error) {
      console.error('Daily storage cleanup migration failed:', error);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getOrCreateDailyTargetWord = useCallback(async (dateKey) => {
    const key = getDailyTargetStorageKey(GAME_MODE_DAILY, dateKey);
    const dailyRecord = await getDailyWordRecord(dateKey);
    const canonicalWord = dailyRecord.word;

    const existing = localStorage.getItem(key);
    if (existing === canonicalWord) return existing;

    localStorage.setItem(key, canonicalWord);
    if (existing && existing !== canonicalWord) {
      localStorage.removeItem(getDailyClueStorageKey(GAME_MODE_DAILY, dateKey));
      localStorage.removeItem(getDailyStateStorageKey(GAME_MODE_DAILY, dateKey));
    }
    return canonicalWord;
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getOrCreateDailyClue = useCallback(async (word, dateKey, dailyRecord = null) => {
    const key = getDailyClueStorageKey(GAME_MODE_DAILY, dateKey);
    const existing = localStorage.getItem(key);
    if (existing) {
      const maskedClue = maskWordInText(existing, word);
      if (maskedClue !== existing) {
        localStorage.setItem(key, maskedClue);
      }
      return maskedClue;
    }

    try {
      const def = dailyRecord?.definition
        ? { definitions: [{ definition: dailyRecord.definition }] }
        : await getWordDefinition(word);
      const clue = getClueForDaily(def.definitions, dateKey, word);
      localStorage.setItem(key, clue);
      return clue;
    } catch (error) {
      const fallback = 'No clue available';
      localStorage.setItem(key, fallback);
      return fallback;
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getOrCreateDailyLadderWords = useCallback(async (dateKey) => {
    const key = getDailyLadderWordsStorageKey(dateKey);

    try {
      const existing = JSON.parse(localStorage.getItem(key) || 'null');
      const isValidExisting = Array.isArray(existing)
        && existing.length === LADDER_WORD_LENGTHS.length
        && existing.every((word, index) => typeof word === 'string' && word.length === LADDER_WORD_LENGTHS[index]);

      if (isValidExisting) {
        return existing;
      }
    } catch {
      // Ignore malformed cache and rebuild it.
    }

    const ladderWords = await getDailyLadderWords(dateKey);

    localStorage.setItem(key, JSON.stringify(ladderWords));
    return ladderWords;
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadDailySavedState = useCallback((mode, dateKey) => {
    const raw = localStorage.getItem(getDailyStateStorageKey(mode, dateKey));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveDailyState = useCallback((mode, dateKey, nextState) => {
    const payload = {
      // daily identity
      gameMode: mode,
      dailyDateKey: dateKey,

      // gameplay
      guesses: nextState.guesses,
      currentGuess: nextState.currentGuess,
      currentRow: nextState.currentRow,
      targetWord: nextState.targetWord,
      activeWordLength: nextState.activeWordLength,
      gameOver: nextState.gameOver,
      isSuccess: nextState.isSuccess,
      completedWord: nextState.completedWord,
      evaluations: nextState.evaluations,
      letterStates: nextState.letterStates,
      ladderWords: nextState.ladderWords,
      ladderStageIndex: nextState.ladderStageIndex,
      ladderCompletedStages: nextState.ladderCompletedStages,
      ladderGuessCounts: nextState.ladderGuessCounts,
      ladderTotalGuesses: nextState.ladderTotalGuesses,

      // clue (avoid extra API calls)
      clue: nextState.clue,
      showClue: nextState.showClue,

      // Keep revealedLetters empty so we don’t replay flip animations on reload
      revealedLetters: createBoardState(nextState.activeWordLength || DEFAULT_WORD_LENGTH).revealedLetters,
    };
    localStorage.setItem(getDailyStateStorageKey(mode, dateKey), JSON.stringify(payload));
  }, []);

  const loadClueForWord = useCallback(async (word) => {
    try {
      const def = await getWordDefinition(word);
      dispatch({ type: 'SET_CLUE', clue: maskWordInText(def.definitions[0]?.definition || 'No clue available', word) });
      dispatch({ type: 'SET_SHOW_CLUE', showClue: true });
    } catch (e) {
      dispatch({ type: 'SET_CLUE', clue: 'No clue available' });
      dispatch({ type: 'SET_SHOW_CLUE', showClue: true });
    }
  }, []);

  const resetModalState = useCallback(() => {
    dispatch({ type: 'SET_SHOW_MODAL', showModal: false });
    dispatch({ type: 'SET_MODAL_VARIANT', modalVariant: MODAL_VARIANT_RESULT });
    dispatch({ type: 'SET_MODAL_TITLE', modalTitle: '' });
    dispatch({ type: 'SET_MODAL_ACTION_LABEL', modalActionLabel: '' });
    dispatch({ type: 'SET_MODAL_PROGRESS_LABEL', modalProgressLabel: '' });
  }, []);

  const showMessage = useCallback((msg) => {
    dispatch({ type: 'SET_MESSAGE', message: msg });
    setTimeout(() => dispatch({ type: 'SET_MESSAGE', message: '' }), 2000);
  }, []);

  const startLadderStage = useCallback(async ({ ladderWords, stageIndex, completedStages, guessCounts, totalGuesses, gameMode = GAME_MODE_LADDER, dailyDateKey = getLocalDateKey() }) => {
    const targetWord = ladderWords[stageIndex];
    const stats = loadStats(gameMode);
    dispatch({
      type: 'RESET',
      targetWord,
      wordLength: targetWord.length,
      keepStreak: false,
      resetStreak: true,
      gameMode,
      dailyDateKey,
      ladderWords,
      ladderStageIndex: stageIndex,
      ladderCompletedStages: completedStages,
      ladderGuessCounts: guessCounts,
      ladderTotalGuesses: totalGuesses,
      stats,
    });
    resetModalState();
    await loadClueForWord(targetWord);
  }, [loadClueForWord, resetModalState]);

  const startPracticeGame = useCallback(async (resetStreak = false, animate = false) => {
    if (animate) {
      dispatch({ type: 'SET_ANIMATE_SCORE', animateScore: true });
      dispatch({ type: 'SET_ANIMATE_STREAK', animateStreak: true });
    }
    dispatch({ type: 'SET_IS_LOADING', isLoading: true });
    try {
      const todayKey = getLocalDateKey();
      const dailyWord = localStorage.getItem(getDailyTargetStorageKey(GAME_MODE_DAILY, todayKey));
      const exclude = dailyWord ? [dailyWord] : [];
      const newWord = await getRandomWord(exclude, DEFAULT_WORD_LENGTH);
      dispatch({
        type: 'RESET',
        targetWord: newWord,
        wordLength: DEFAULT_WORD_LENGTH,
        keepStreak: !resetStreak,
        resetStreak,
        gameMode: GAME_MODE_PRACTICE,
        stats: loadStats(GAME_MODE_PRACTICE),
      });
      resetModalState();
      await loadClueForWord(newWord);
    } catch (error) {
      console.error('Error selecting word:', error);
      showMessage('Error loading word. Please try again.');
    } finally {
      dispatch({ type: 'SET_IS_LOADING', isLoading: false });
      refocusGameInput();
    }
  }, [loadClueForWord, refocusGameInput, resetModalState, showMessage]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startLadderGame = useCallback(async () => {
    dispatch({ type: 'SET_IS_LOADING', isLoading: true });
    try {
      const todayKey = getLocalDateKey();
      const dailyWord = localStorage.getItem(getDailyTargetStorageKey(GAME_MODE_DAILY, todayKey));
      const ladderWords = await Promise.all(
        LADDER_WORD_LENGTHS.map((length) => {
          const exclude = length === DEFAULT_WORD_LENGTH && dailyWord ? [dailyWord] : [];
          return getRandomWord(exclude, length);
        })
      );
      await startLadderStage({
        ladderWords,
        stageIndex: 0,
        completedStages: [],
        guessCounts: [],
        totalGuesses: 0,
      });
    } catch (error) {
      console.error('Error starting ladder game:', error);
      showMessage('Error loading ladder. Please try again.');
    } finally {
      dispatch({ type: 'SET_IS_LOADING', isLoading: false });
      refocusGameInput();
    }
  }, [refocusGameInput, showMessage, startLadderStage]);

  const startDailyLadderGame = useCallback(async (dateKey) => {
    dispatch({ type: 'SET_IS_LOADING', isLoading: true });
    try {
      const normalizedDateKey = dateKey || getLocalDateKey();
      const ladderWords = await getOrCreateDailyLadderWords(normalizedDateKey);
      const saved = loadDailySavedState(GAME_MODE_DAILY_LADDER, normalizedDateKey);

      if (
        saved
        && saved.gameMode === GAME_MODE_DAILY_LADDER
        && Array.isArray(saved.ladderWords)
        && JSON.stringify(saved.ladderWords) === JSON.stringify(ladderWords)
      ) {
        const activeWordLength = saved.activeWordLength || saved.targetWord?.length || DEFAULT_WORD_LENGTH;
        const hydrated = {
          ...initialState,
          ...saved,
          gameMode: GAME_MODE_DAILY_LADDER,
          dailyDateKey: normalizedDateKey,
          ladderWords,
          targetWord: saved.targetWord || ladderWords[saved.ladderStageIndex || 0],
          activeWordLength,
          guesses: saved.guesses || Array(MAX_GUESSES).fill(''),
          evaluations: saved.evaluations || Array(MAX_GUESSES).fill(null),
          revealedLetters: createBoardState(activeWordLength).revealedLetters,
          letterStates: saved.letterStates || computeLetterStatesFromHistory(
            saved.guesses || Array(MAX_GUESSES).fill(''),
            saved.evaluations || Array(MAX_GUESSES).fill(null)
          ),
        };
        dispatch({ type: 'LOAD_SAVED_GAME', saved: hydrated });
        dispatch({ type: 'SET_STATS', stats: loadStats(GAME_MODE_DAILY_LADDER) });
      } else {
        await startLadderStage({
          ladderWords,
          stageIndex: 0,
          completedStages: [],
          guessCounts: [],
          totalGuesses: 0,
          gameMode: GAME_MODE_DAILY_LADDER,
          dailyDateKey: normalizedDateKey,
        });
      }
    } catch (error) {
      console.error('Error starting daily ladder game:', error);
      showMessage('Error loading daily ladder. Please try again.');
    } finally {
      dispatch({ type: 'SET_IS_LOADING', isLoading: false });
      refocusGameInput();
    }
  }, [getOrCreateDailyLadderWords, loadDailySavedState, refocusGameInput, showMessage, startLadderStage]);

  const startDailyGame = useCallback(async (dateKey) => {
    dispatch({ type: 'SET_IS_LOADING', isLoading: true });
    try {
      const normalizedDateKey = dateKey || getLocalDateKey();
      const dailyRecord = await getDailyWordRecord(normalizedDateKey);
      const targetWord = await getOrCreateDailyTargetWord(normalizedDateKey);

      const saved = loadDailySavedState(GAME_MODE_DAILY, normalizedDateKey);
      if (saved && saved.targetWord === targetWord) {
        const hydrated = {
          ...initialState,
          ...saved,
          targetWord,
          clue: maskWordInText(saved.clue, targetWord),
          gameMode: GAME_MODE_DAILY,
          dailyDateKey: normalizedDateKey,
          activeWordLength: DEFAULT_WORD_LENGTH,
          // ensure defaults for arrays if missing
          guesses: saved.guesses || Array(MAX_GUESSES).fill(''),
          evaluations: saved.evaluations || Array(MAX_GUESSES).fill(null),
          revealedLetters: createBoardState(DEFAULT_WORD_LENGTH).revealedLetters,
          letterStates: saved.letterStates || computeLetterStatesFromHistory(saved.guesses || Array(MAX_GUESSES).fill(''), saved.evaluations || Array(MAX_GUESSES).fill(null)),
        };
        dispatch({ type: 'LOAD_SAVED_GAME', saved: hydrated });
        dispatch({ type: 'SET_STATS', stats: loadStats(GAME_MODE_DAILY) });
      } else {
        dispatch({
          type: 'RESET',
          targetWord,
          wordLength: DEFAULT_WORD_LENGTH,
          keepStreak: false,
          resetStreak: true,
          gameMode: GAME_MODE_DAILY,
          dailyDateKey: normalizedDateKey,
          stats: loadStats(GAME_MODE_DAILY),
        });
        const clue = await getOrCreateDailyClue(targetWord, normalizedDateKey, dailyRecord);
        dispatch({ type: 'SET_CLUE', clue });
        dispatch({ type: 'SET_SHOW_CLUE', showClue: true });
      }
    } catch (error) {
      console.error('Error starting daily game:', error);
      showMessage('Error loading daily word. Please try again.');
    } finally {
      dispatch({ type: 'SET_IS_LOADING', isLoading: false });
      refocusGameInput();
    }
  }, [getOrCreateDailyTargetWord, getOrCreateDailyClue, loadDailySavedState, refocusGameInput, showMessage]);

  useEffect(() => {
    runDailyStorageCleanupMigration();
    // Default to Daily mode on load
    startDailyGame(getLocalDateKey());
    dispatch({ type: 'SET_STATS', stats: loadStats(GAME_MODE_DAILY) });
    refocusGameInput();
    
    // Show tutorial on first visit
    const hasSeenTutorial = localStorage.getItem('eleanordle:hasSeenTutorial');
    if (!hasSeenTutorial) {
      setTimeout(() => {
        dispatch({ type: 'SET_SHOW_TUTORIAL', showTutorial: true });
      }, 500);
      localStorage.setItem('eleanordle:hasSeenTutorial', 'true');
    }
  }, [refocusGameInput, runDailyStorageCleanupMigration, startDailyGame]);

  useEffect(() => {
    if (!isDailyMode(state.gameMode)) return;
    saveDailyState(state.gameMode, state.dailyDateKey, {
      guesses: state.guesses,
      currentGuess: state.currentGuess,
      currentRow: state.currentRow,
      targetWord: state.targetWord,
      activeWordLength: state.activeWordLength,
      gameOver: state.gameOver,
      isSuccess: state.isSuccess,
      completedWord: state.completedWord,
      evaluations: state.evaluations,
      letterStates: state.letterStates,
      ladderWords: state.ladderWords,
      ladderStageIndex: state.ladderStageIndex,
      ladderCompletedStages: state.ladderCompletedStages,
      ladderGuessCounts: state.ladderGuessCounts,
      ladderTotalGuesses: state.ladderTotalGuesses,
      clue: state.clue,
      showClue: state.showClue,
    });
  }, [
    state.activeWordLength,
    state.gameMode,
    state.dailyDateKey,
    state.guesses,
    state.currentGuess,
    state.currentRow,
    state.targetWord,
    state.gameOver,
    state.isSuccess,
    state.completedWord,
    state.evaluations,
    state.letterStates,
    state.ladderWords,
    state.ladderStageIndex,
    state.ladderCompletedStages,
    state.ladderGuessCounts,
    state.ladderTotalGuesses,
    state.clue,
    state.showClue,
    saveDailyState,
  ]);

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
    if (state.currentGuess.length === state.activeWordLength) {
      (async () => {
        const isValid = await isValidWord(state.currentGuess);
        dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: !isValid });
      })();
    } else if (state.invalidGuess && state.currentGuess.length < state.activeWordLength) {
      dispatch({ type: 'SET_INVALID_GUESS', invalidGuess: false });
    }
  }, [state.currentGuess, state.activeWordLength, state.invalidGuess]);

  const handleNextWord = useCallback(async () => {
    if (isLadderMode(state.gameMode)) {
      if (state.modalVariant === MODAL_VARIANT_LADDER_STAGE) {
        await startLadderStage({
          ladderWords: state.ladderWords,
          stageIndex: state.ladderStageIndex + 1,
          completedStages: state.ladderCompletedStages,
          guessCounts: state.ladderGuessCounts,
          totalGuesses: state.ladderTotalGuesses,
          gameMode: state.gameMode,
          dailyDateKey: state.dailyDateKey,
        });
        return;
      }
      if (state.gameMode === GAME_MODE_DAILY_LADDER) {
        resetModalState();
        return;
      }
      await startLadderGame();
      return;
    }

    if (state.isSuccess) {
      dispatch({ type: 'INCREMENT_STREAK' });
      dispatch({ type: 'ADD_TO_TOTAL_SCORE' });
      dispatch({ type: 'SET_ANIMATE_SCORE', animateScore: true });
    }
    resetModalState();
    await startPracticeGame(!state.isSuccess, state.isSuccess);
  }, [
    resetModalState,
    startLadderGame,
    startLadderStage,
    startPracticeGame,
    state.dailyDateKey,
    state.gameMode,
    state.isSuccess,
    state.ladderCompletedStages,
    state.ladderGuessCounts,
    state.ladderStageIndex,
    state.ladderTotalGuesses,
    state.ladderWords,
    state.modalVariant,
  ]);

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

  const revealRowLetters = useCallback((rowIndex) => {
    for (let i = 0; i < state.activeWordLength; i++) {
      setTimeout(() => {
        dispatch({ type: 'REVEAL_LETTER', rowIndex, letterIndex: i });
      }, i * 200);
    }
  }, [state.activeWordLength]);

  const submitGuess = useCallback(async () => {
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
    dispatch({ type: 'SET_REVEALED_LETTERS', revealedLetters: state.revealedLetters.map((arr, idx) => idx === state.currentRow ? Array(state.activeWordLength).fill(false) : arr.slice()) });
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

    const revealDelay = state.activeWordLength * 200 + 200;
    const nextRowDelay = state.activeWordLength * 200 + 100;

    if (state.currentGuess === state.targetWord) {
      const winGuessCount = state.currentRow + 1;
      const winDailyKey = isDailyMode(state.gameMode) ? state.dailyDateKey : null;
      const nextGuessCounts = [...state.ladderGuessCounts, winGuessCount];
      const nextCompletedStages = [...state.ladderCompletedStages, state.targetWord];
      const nextTotalGuesses = state.ladderTotalGuesses + winGuessCount;
      const isFinalLadderStage = isLadderMode(state.gameMode) && state.ladderStageIndex === LADDER_WORD_LENGTHS.length - 1;

      setTimeout(async () => {
        dispatch({ type: 'SET_GAME_OVER', gameOver: true });
        dispatch({ type: 'SET_IS_SUCCESS', isSuccess: true });
        dispatch({ type: 'SET_COMPLETED_WORD', completedWord: state.targetWord });
        dispatch({ type: 'SET_LADDER_GUESS_COUNTS', ladderGuessCounts: nextGuessCounts });
        dispatch({ type: 'SET_LADDER_COMPLETED_STAGES', ladderCompletedStages: nextCompletedStages });
        dispatch({ type: 'SET_LADDER_TOTAL_GUESSES', ladderTotalGuesses: nextTotalGuesses });

        let definition = definitionCache.current[state.targetWord];
        if (!definition) {
          try {
            definition = await getWordDefinition(state.targetWord);
          } catch {
            definition = { word: state.targetWord, definitions: [{ definition: 'Definition not available' }] };
          }
        }
        definitionCache.current[state.targetWord] = definition;
        dispatch({ type: 'SET_WORD_DEFINITION', wordDefinition: definition });

        if (isLadderMode(state.gameMode)) {
          if (isFinalLadderStage) {
            const updatedStats = recordGameResult({
              isSuccess: true,
              guessCount: nextTotalGuesses,
              dailyDateKey: state.gameMode === GAME_MODE_DAILY_LADDER ? state.dailyDateKey : null,
              mode: state.gameMode,
            });
            dispatch({ type: 'SET_STATS', stats: updatedStats });
            dispatch({ type: 'SET_MODAL_VARIANT', modalVariant: MODAL_VARIANT_RESULT });
            dispatch({ type: 'SET_MODAL_TITLE', modalTitle: state.gameMode === GAME_MODE_DAILY_LADDER ? 'Daily Ladder Complete!' : 'Ladder Complete!' });
            dispatch({ type: 'SET_MODAL_ACTION_LABEL', modalActionLabel: state.gameMode === GAME_MODE_DAILY_LADDER ? 'Close' : 'Play Again' });
            dispatch({ type: 'SET_MODAL_PROGRESS_LABEL', modalProgressLabel: `Solved all ${LADDER_WORD_LENGTHS.length} stages in ${nextTotalGuesses} guesses.` });
          } else {
            const nextLength = LADDER_WORD_LENGTHS[state.ladderStageIndex + 1];
            dispatch({ type: 'SET_MODAL_VARIANT', modalVariant: MODAL_VARIANT_LADDER_STAGE });
            dispatch({ type: 'SET_MODAL_TITLE', modalTitle: `Stage ${state.ladderStageIndex + 1} Cleared` });
            dispatch({ type: 'SET_MODAL_ACTION_LABEL', modalActionLabel: `Continue to ${nextLength}-Letter Word` });
            dispatch({ type: 'SET_MODAL_PROGRESS_LABEL', modalProgressLabel: `Unlocked stage ${state.ladderStageIndex + 2} of ${LADDER_WORD_LENGTHS.length}.` });
          }
        } else {
          const updatedStats = recordGameResult({ isSuccess: true, guessCount: winGuessCount, dailyDateKey: winDailyKey, mode: state.gameMode });
          dispatch({ type: 'SET_STATS', stats: updatedStats });
          dispatch({ type: 'SET_MODAL_VARIANT', modalVariant: MODAL_VARIANT_RESULT });
          dispatch({ type: 'SET_MODAL_TITLE', modalTitle: state.gameMode === GAME_MODE_DAILY ? 'Congratulations!' : 'Nice Solve' });
          dispatch({ type: 'SET_MODAL_ACTION_LABEL', modalActionLabel: state.gameMode === GAME_MODE_DAILY ? 'Close' : 'Next Word' });
          dispatch({ type: 'SET_MODAL_PROGRESS_LABEL', modalProgressLabel: '' });
        }
        dispatch({ type: 'SET_SHOW_MODAL', showModal: true });
      }, revealDelay);
    } else if (state.currentRow === MAX_GUESSES - 1) {
      const lossDailyKey = isDailyMode(state.gameMode) ? state.dailyDateKey : null;
      setTimeout(async () => {
        dispatch({ type: 'SET_GAME_OVER', gameOver: true });
        dispatch({ type: 'SET_COMPLETED_WORD', completedWord: state.targetWord });
        dispatch({ type: 'RESET_STREAK' });
        dispatch({ type: 'SET_IS_SUCCESS', isSuccess: false });
        let updatedStats;
        if (isLadderMode(state.gameMode)) {
          updatedStats = recordGameResult({
            isSuccess: false,
            guessCount: state.ladderTotalGuesses + MAX_GUESSES,
            dailyDateKey: state.gameMode === GAME_MODE_DAILY_LADDER ? state.dailyDateKey : null,
            mode: state.gameMode,
          });
          dispatch({ type: 'SET_MODAL_TITLE', modalTitle: state.gameMode === GAME_MODE_DAILY_LADDER ? 'Daily Ladder Failed' : 'Ladder Failed' });
          dispatch({ type: 'SET_MODAL_ACTION_LABEL', modalActionLabel: state.gameMode === GAME_MODE_DAILY_LADDER ? 'Close' : 'Try New Ladder' });
          dispatch({ type: 'SET_MODAL_PROGRESS_LABEL', modalProgressLabel: `Reached the ${state.activeWordLength}-letter stage.` });
        } else {
          updatedStats = recordGameResult({ isSuccess: false, guessCount: MAX_GUESSES, dailyDateKey: lossDailyKey, mode: state.gameMode });
          dispatch({ type: 'SET_MODAL_TITLE', modalTitle: 'Game Over' });
          dispatch({ type: 'SET_MODAL_ACTION_LABEL', modalActionLabel: state.gameMode === GAME_MODE_DAILY ? 'Close' : 'Try Again' });
          dispatch({ type: 'SET_MODAL_PROGRESS_LABEL', modalProgressLabel: '' });
        }
        dispatch({ type: 'SET_STATS', stats: updatedStats });
        try {
          let definition = definitionCache.current[state.targetWord];
          if (!definition) {
            definition = await getWordDefinition(state.targetWord);
          }
          definitionCache.current[state.targetWord] = definition;
          dispatch({ type: 'SET_WORD_DEFINITION', wordDefinition: definition });
        } catch {}
        dispatch({ type: 'SET_MODAL_VARIANT', modalVariant: MODAL_VARIANT_RESULT });
        dispatch({ type: 'SET_SHOW_MODAL', showModal: true });
      }, revealDelay);
    } else {
      setTimeout(() => {
        dispatch({ type: 'SET_CURRENT_ROW', currentRow: state.currentRow + 1 });
        dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: '' });
      }, nextRowDelay);
    }
  }, [
    revealRowLetters,
    state.activeWordLength,
    state.currentGuess,
    state.currentRow,
    state.dailyDateKey,
    state.evaluations,
    state.gameMode,
    state.guesses,
    state.ladderCompletedStages,
    state.ladderGuessCounts,
    state.ladderStageIndex,
    state.ladderTotalGuesses,
    state.letterStates,
    state.revealedLetters,
    state.rowScores,
    state.score,
    state.targetWord,
    state.wrongPositionHistory,
  ]);

  const handleKeyPress = useCallback((key) => {
    if (state.gameOver) return;

    if (key === 'ENTER') {
      if (state.currentGuess.length !== state.activeWordLength) {
        showMessage(`Word must be ${state.activeWordLength} letters`);
        return;
      }
      submitGuess();
    } else if (key === 'BACKSPACE') {
      dispatch({ type: 'REMOVE_LAST_CURRENT_GUESS' });
    } else if (/^[A-Z]$/.test(key)) {
      dispatch({ type: 'APPEND_CURRENT_GUESS', key });
    }
  }, [showMessage, state.activeWordLength, state.currentGuess.length, state.gameOver, submitGuess]);

  const getTileClass = (letter, index, rowIndex) => {
    if (rowIndex > state.currentRow) return '';
    const classes = [];
    if (rowIndex < state.currentRow) {
      const evaluation = state.evaluations[rowIndex];
      if (evaluation) {
        // Always show final color for completed rows (even after reload)
        classes.push(evaluation[index]);
        // Only animate when the letter has been revealed in this session
        if (state.revealedLetters[rowIndex][index]) classes.push('flip');
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
        setDailyMenuOpen(false);
        setInfiniteMenuOpen(false);
        setOptionsMenuOpen(false);
      }
    };
    if (state.menuOpen) {
      document.addEventListener('mousedown', handleClick);
    } else {
      document.removeEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [state.menuOpen]);

  useEffect(() => {
    if (!state.menuOpen) {
      setDailyMenuOpen(false);
      setInfiniteMenuOpen(false);
      setOptionsMenuOpen(false);
    }
  }, [state.menuOpen]);

  const revealAnswer = useCallback(async () => {
    if (state.gameOver) return;
    if (isDailyMode(state.gameMode)) {
      showMessage('Daily mode: no reveals');
      dispatch({ type: 'SET_MENU_OPEN', menuOpen: false });
      return;
    }
    if (state.gameMode === GAME_MODE_LADDER) {
      showMessage('Ladder mode: no reveals');
      dispatch({ type: 'SET_MENU_OPEN', menuOpen: false });
      return;
    }
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
    dispatch({ type: 'SET_REVEALED_LETTERS', revealedLetters: state.revealedLetters.map((arr, idx) => idx === revealRow ? Array(state.activeWordLength).fill(false) : [...arr]) });
    revealRowLetters(revealRow);
    const newLetterStates = { ...state.letterStates };
    for (let i = 0; i < answer.length; i++) {
      const letter = answer[i];
      newLetterStates[letter] = evaluation[i];
    }
    dispatch({ type: 'SET_LETTER_STATES', letterStates: newLetterStates });
    setTimeout(async () => {
      dispatch({ type: 'SET_GAME_OVER', gameOver: true });
      dispatch({ type: 'SET_IS_SUCCESS', isSuccess: false });
      dispatch({ type: 'SET_COMPLETED_WORD', completedWord: state.targetWord });
      try {
        const def = await getWordDefinition(state.targetWord);
        dispatch({ type: 'SET_WORD_DEFINITION', wordDefinition: def });
        dispatch({ type: 'SET_MODAL_VARIANT', modalVariant: MODAL_VARIANT_RESULT });
        dispatch({ type: 'SET_MODAL_TITLE', modalTitle: 'Answer Revealed' });
        dispatch({ type: 'SET_MODAL_ACTION_LABEL', modalActionLabel: 'Try Again' });
        dispatch({ type: 'SET_SHOW_MODAL', showModal: true });
      } catch (error) {
        dispatch({ type: 'SET_MODAL_VARIANT', modalVariant: MODAL_VARIANT_RESULT });
        dispatch({ type: 'SET_MODAL_TITLE', modalTitle: 'Answer Revealed' });
        dispatch({ type: 'SET_MODAL_ACTION_LABEL', modalActionLabel: 'Try Again' });
        dispatch({ type: 'SET_SHOW_MODAL', showModal: true });
      }
    }, state.activeWordLength * 200 + 200);
    dispatch({ type: 'SET_MENU_OPEN', menuOpen: false });
  }, [
    revealRowLetters,
    showMessage,
    state.activeWordLength,
    state.evaluations,
    state.gameMode,
    state.gameOver,
    state.guesses,
    state.letterStates,
    state.revealedLetters,
    state.targetWord,
  ]);

  const getClue = useCallback(async () => {
    if (state.targetWord) {
      try {
        const def = await getWordDefinition(state.targetWord);
        dispatch({ type: 'SET_CLUE', clue: maskWordInText(def.definitions[0]?.definition || 'No clue available', state.targetWord) });
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
    const correct = Array(state.activeWordLength).fill(null);
    const wrongPosition = new Set();
    const present = new Set();
    const absent = new Set();
    for (let row = 0; row < state.evaluations.length; row++) {
      const evalRow = state.evaluations[row];
      const guess = state.guesses[row] || '';
      if (!evalRow) continue;
      for (let i = 0; i < state.activeWordLength; i++) {
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
      const newWords = await getDictionaryWords(null, state.activeWordLength);
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
    refocusGameInput();
  }, [refocusGameInput, showMessage, state.activeWordLength, state.evaluations, state.guesses, state.usedSuggestions, state.targetWord]);

  useEffect(() => {
    if (state.pendingSuggestion && state.currentGuess.length === state.activeWordLength) {
      dispatch({ type: 'SET_PENDING_SUGGESTION', pendingSuggestion: false });
      submitGuess();
    }
    // eslint-disable-next-line
  }, [state.pendingSuggestion, state.currentGuess, state.activeWordLength]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleMenuShortcuts = (e) => {
      if (e.altKey && e.shiftKey && !e.ctrlKey) {
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          if (!state.showClue) getClue();
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          if (!isDailyMode(state.gameMode)) handleShowSuggestions();
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          if (isDailyMode(state.gameMode)) {
            localStorage.removeItem(getDailyStateStorageKey(state.gameMode, state.dailyDateKey));
            if (state.gameMode === GAME_MODE_DAILY_LADDER) {
              startDailyLadderGame(state.dailyDateKey);
            } else {
              startDailyGame(state.dailyDateKey);
            }
          } else if (state.gameMode === GAME_MODE_LADDER) {
            startLadderGame();
          } else {
            startPracticeGame(true);
          }
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          revealAnswer();
        }
      }
    };
    window.addEventListener('keydown', handleMenuShortcuts);
    return () => window.removeEventListener('keydown', handleMenuShortcuts);
  }, [state.showClue, state.gameMode, state.dailyDateKey, getClue, handleShowSuggestions, startDailyGame, startDailyLadderGame, startLadderGame, startPracticeGame, revealAnswer]);

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
      if (transcript.length !== state.activeWordLength) {
        showMessage(`Please say a ${state.activeWordLength}-letter word.`);
        return;
      }
      dispatch({ type: 'SET_CURRENT_GUESS', currentGuess: transcript });
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className={`wordle ${state.isContrastMode ? 'contrast' : ''} ${state.isDarkMode ? 'dark' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        value={state.currentGuess}
        maxLength={state.activeWordLength}
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
      <div className="mode-header">
        {getModeLabel(state.gameMode).split('').map((letter, idx) => (
          <span key={`${letter}-${idx}`} className="mode-logo-tile" aria-hidden="true">
            {letter}
          </span>
        ))}
        <span className="sr-only">{state.gameMode === GAME_MODE_DAILY ? 'Daily mode' : state.gameMode === GAME_MODE_DAILY_LADDER ? 'Daily ladder mode' : state.gameMode === GAME_MODE_LADDER ? 'Ladder mode' : 'Infinite mode'}</span>
      </div>
      <div className="game-header">
        <div className="header-content">
          <h1><Logo /></h1>
        </div>
        <div className="header-actions">
          {!isDailyMode(state.gameMode) && (
            <button
              onClick={handleShowSuggestions}
              onMouseDown={preventButtonFocus}
              className="header-icon-btn"
              title="Suggest Word (Alt+Shift+S)"
              aria-label="Suggest Word"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
                <path d="M0 0h24v24H0V0z" fill="none"/>
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </button>
          )}
          {/* Microphone button hidden unless enabled */}
          {state.micEnabled && (
            <button
              onClick={() => {
                handleMicInput();
                refocusGameInput();
              }}
              onMouseDown={preventButtonFocus}
              className="header-icon-btn"
              title="Speak Word (Microphone)"
              aria-label="Speak Word"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
                <path d="M0 0h24v24H0V0z" fill="none"/>
                <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3s-3 1.34-3 3v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.07 2.13 5.64 5 6.32V21h2v-2.68c2.87-.68 5-3.25 5-6.32h-2z"/>
              </svg>
            </button>
          )}
          <div className="burger-menu-anchor">
            <button
              className={`burger-menu-btn ${state.menuOpen ? 'open' : ''}`}
              aria-label="Open menu"
              onMouseDown={preventButtonFocus}
              onClick={() => {
                if (state.menuOpen) {
                  setDailyMenuOpen(false);
                  setInfiniteMenuOpen(false);
                  setOptionsMenuOpen(false);
                }
                dispatch({ type: 'SET_MENU_OPEN', menuOpen: !state.menuOpen });
                refocusGameInput();
              }}
            >
              <span className="burger-bar"></span>
              <span className="burger-bar"></span>
              <span className="burger-bar"></span>
            </button>
            {state.menuOpen && (
              <div className="burger-dropdown" ref={menuRef}>

                {state.gameMode === GAME_MODE_DAILY && state.gameOver && (
                  <button
                    onMouseDown={preventButtonFocus}
                    onClick={async () => {
                      const shareText = buildShareText({
                        dateKey: state.dailyDateKey,
                        evaluations: state.evaluations,
                        isSuccess: state.isSuccess,
                      });
                      try {
                        await navigator.clipboard.writeText(shareText);
                        showMessage('Copied share grid');
                      } catch {
                        showMessage('Copy failed');
                      }
                      closeMenu();
                      refocusGameInput();
                    }}
                    className="dropdown-item"
                  >
                    Share Result
                  </button>
                )}

                <div className="dropdown-submenu">
                  <button
                    onMouseDown={preventButtonFocus}
                    onClick={() => {
                      setDailyMenuOpen((current) => !current);
                      refocusGameInput();
                    }}
                    className="dropdown-item dropdown-submenu-trigger"
                    aria-expanded={dailyMenuOpen}
                    aria-haspopup="true"
                  >
                    <span>Daily</span>
                    <span className={`dropdown-caret ${dailyMenuOpen ? 'open' : ''}`} aria-hidden="true">▸</span>
                  </button>
                  {dailyMenuOpen && (
                    <div className="dropdown-submenu-items">
                      <button
                        onMouseDown={preventButtonFocus}
                        onClick={() => {
                          closeMenu();
                          startDailyGame(getLocalDateKey());
                        }}
                        className="dropdown-item dropdown-subitem"
                      >
                        Daily
                      </button>
                      <button
                        onMouseDown={preventButtonFocus}
                        onClick={() => {
                          closeMenu();
                          startDailyLadderGame(getLocalDateKey());
                        }}
                        className="dropdown-item dropdown-subitem"
                      >
                        Daily Ladder
                      </button>
                    </div>
                  )}
                </div>
                <div className="dropdown-submenu">
                  <button
                    onMouseDown={preventButtonFocus}
                    onClick={() => {
                      setInfiniteMenuOpen((current) => !current);
                      refocusGameInput();
                    }}
                    className="dropdown-item dropdown-submenu-trigger"
                    aria-expanded={infiniteMenuOpen}
                    aria-haspopup="true"
                  >
                    <span>Infinite</span>
                    <span className={`dropdown-caret ${infiniteMenuOpen ? 'open' : ''}`} aria-hidden="true">▸</span>
                  </button>
                  {infiniteMenuOpen && (
                    <div className="dropdown-submenu-items">
                      <button
                        onMouseDown={preventButtonFocus}
                        onClick={() => {
                          closeMenu();
                          startPracticeGame(true);
                        }}
                        className="dropdown-item dropdown-subitem"
                      >
                        Infinite
                      </button>
                      <button
                        onMouseDown={preventButtonFocus}
                        onClick={() => {
                          closeMenu();
                          startLadderGame();
                        }}
                        className="dropdown-item dropdown-subitem"
                      >
                        Ladder
                      </button>
                    </div>
                  )}
                </div>
                <div className="dropdown-submenu">
                  <button
                    onMouseDown={preventButtonFocus}
                    onClick={() => {
                      setOptionsMenuOpen((current) => !current);
                      refocusGameInput();
                    }}
                    className="dropdown-item dropdown-submenu-trigger"
                    aria-expanded={optionsMenuOpen}
                    aria-haspopup="true"
                  >
                    <span>Options</span>
                    <span className={`dropdown-caret ${optionsMenuOpen ? 'open' : ''}`} aria-hidden="true">▸</span>
                  </button>
                  {optionsMenuOpen && (
                    <div className="dropdown-submenu-items">
                      <button
                        onMouseDown={preventButtonFocus}
                        onClick={() => {
                          dispatch({ type: 'SET_IS_CONTRAST_MODE', isContrastMode: !state.isContrastMode });
                          refocusGameInput();
                        }}
                        className="dropdown-item dropdown-subitem"
                      >
                        Contrast Mode
                      </button>
                      <button
                        onMouseDown={preventButtonFocus}
                        onClick={() => {
                          const next = !state.isDarkMode;
                          dispatch({ type: 'SET_IS_DARK_MODE', isDarkMode: next });
                          localStorage.setItem('darkMode', next);
                          refocusGameInput();
                        }}
                        className="dropdown-item dropdown-subitem"
                      >
                        {state.isDarkMode ? 'Light Mode' : 'Dark Mode'}
                      </button>
                      <button
                        onMouseDown={preventButtonFocus}
                        onClick={() => {
                          dispatch({ type: 'SET_MIC_ENABLED', micEnabled: !state.micEnabled });
                          refocusGameInput();
                        }}
                        className="dropdown-item dropdown-subitem"
                      >
                        {state.micEnabled ? 'Disable Microphone' : 'Enable Microphone'}
                      </button>
                      <button
                        onMouseDown={preventButtonFocus}
                        onClick={() => {
                          closeMenu();
                          dispatch({ type: 'SET_SHOW_TUTORIAL', showTutorial: true });
                          refocusGameInput();
                        }}
                        className="dropdown-item dropdown-subitem"
                      >
                        Tutorial
                      </button>
                    </div>
                  )}
                </div>
                
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
        {isLadderMode(state.gameMode) && (
          <div className="ladder-progress">
            {state.gameMode === GAME_MODE_DAILY_LADDER ? 'Daily Ladder' : 'Ladder'}: Stage {state.ladderStageIndex + 1} of {LADDER_WORD_LENGTHS.length}: {state.activeWordLength}-letter word
          </div>
        )}
        <div className="wordle-grid" style={{ gridTemplateRows: `repeat(${MAX_GUESSES}, 1fr)` }}>
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
              <div 
                key={rowIndex} 
                className="wordle-row"
                style={{ gridTemplateColumns: `repeat(${state.activeWordLength}, 1fr)` }}
                onClick={() => {
                  if (rowIndex < state.currentRow && state.guesses[rowIndex] && showDefinitionIcon) {
                    handleShowDefinition(state.guesses[rowIndex]);
                  }
                }}
              >
                {Array.from({ length: state.activeWordLength }, (_, index) => (
                  <div
                    key={index}
                    className={`wordle-tile ${getTileClass(guess[index], index, rowIndex)}${rowIndex === state.currentRow && state.invalidGuess ? ' invalid' : ''}`}
                    style={getFlipDelay(index)}
                  >
                    {rowIndex === state.revealedAnswerRow ? state.targetWord[index] : (rowIndex === state.currentRow ? state.currentGuess[index] || '' : state.guesses[rowIndex][index] || '')}
                    {state.isContrastMode && state.evaluations[rowIndex] && state.revealedLetters[rowIndex][index] && (
                      <div className="contrast-icon" aria-hidden="true">
                        {state.evaluations[rowIndex][index] === 'correct' && <span className="contrast-badge contrast-badge--correct" title="Exact match">E</span>}
                        {state.evaluations[rowIndex][index] === 'wrong-position' && <span className="contrast-badge contrast-badge--wrong-position" title="Misplaced letter">M</span>}
                        {state.evaluations[rowIndex][index] === 'incorrect' && <span className="contrast-badge contrast-badge--incorrect" title="Not in word">X</span>}
                      </div>
                    )}
                    
                  </div>
                ))}
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
                  onMouseDown={preventButtonFocus}
                  onClick={() => {
                    handleKeyPress('ENTER');
                    refocusGameInput();
                  }}
                  data-key="ENTER"
                >
                  ENTER
                </button>
              )}
              {row.split('').map(key => (
                <button
                  key={key}
                  className={`key ${state.letterStates[key] || ''}`}
                  onMouseDown={preventButtonFocus}
                  onClick={() => {
                    handleKeyPress(key);
                    refocusGameInput();
                  }}
                  data-key={key}
                >
                  {key}
                  {state.isContrastMode && state.letterStates[key] && (
                    <div className="contrast-icon" aria-hidden="true">
                      {state.letterStates[key] === 'correct' && <span className="contrast-badge contrast-badge--correct" title="Exact match">E</span>}
                      {state.letterStates[key] === 'wrong-position' && <span className="contrast-badge contrast-badge--wrong-position" title="Misplaced letter">M</span>}
                      {state.letterStates[key] === 'incorrect' && <span className="contrast-badge contrast-badge--incorrect" title="Not in word">X</span>}
                    </div>
                  )}
                </button>
              ))}
              {i === 2 && (
                <button 
                  className="key" 
                  onMouseDown={preventButtonFocus}
                  onClick={() => {
                    handleKeyPress('BACKSPACE');
                    refocusGameInput();
                  }}
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
        onClose={state.gameMode === GAME_MODE_DAILY ? () => resetModalState() : handleNextWord}
        word={state.completedWord}
        definition={state.wordDefinition}
        isSuccess={state.isSuccess}
        onNextWord={state.gameMode === GAME_MODE_DAILY ? () => resetModalState() : handleNextWord}
        gameMode={state.gameMode}
        dailyDateKey={state.dailyDateKey}
        shareText={state.gameMode === GAME_MODE_DAILY ? buildShareText({ dateKey: state.dailyDateKey, evaluations: state.evaluations, isSuccess: state.isSuccess }) : null}
        stats={state.stats}
        variant={state.modalVariant}
        title={state.modalTitle || undefined}
        primaryLabel={state.modalActionLabel || undefined}
        progressLabel={state.modalProgressLabel || undefined}
        onShare={async () => {
          if (state.gameMode !== GAME_MODE_DAILY) return;
          const shareText = buildShareText({
            dateKey: state.dailyDateKey,
            evaluations: state.evaluations,
            isSuccess: state.isSuccess,
          });
          try {
            await navigator.clipboard.writeText(shareText);
            showMessage('Copied share grid');
          } catch {
            showMessage('Copy failed');
          }
        }}
      />
      <DefinitionModal
        isOpen={state.showDefinitionModal}
        onClose={() => dispatch({ type: 'SET_SHOW_DEFINITION_MODAL', showDefinitionModal: false })}
        word={state.definitionModalWord}
        definition={state.definitionModalDefinition}
      />
      <TutorialModal
        isOpen={state.showTutorial}
        onClose={() => dispatch({ type: 'SET_SHOW_TUTORIAL', showTutorial: false })}
      />
    </div>
  );
};

export default Wordle;