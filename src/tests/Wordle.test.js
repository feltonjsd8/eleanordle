import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Wordle from '../components/Wordle';
import DAILY_WORDS from '../services/wordList';

// Mock the dictionary service (daily uses getDictionaryWords)
jest.mock('../services/dictionaryService', () => ({
  getRandomWord: jest.fn((excludeWords = [], length = 5) => {
    if (length === 4) return Promise.resolve('MOSS');
    if (length === 6) return Promise.resolve('PLANET');
    return Promise.resolve('GRAPE');
  }),
  getDictionaryWords: jest.fn(() => Promise.resolve(['APPLE'])),
  getWordDefinition: jest.fn((word) => Promise.resolve({ word, definitions: [{ definition: `Definition for ${word}` }] })),
  isValidWord: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../services/suggestionService', () => ({
  getWordFinderSuggestions: jest.fn(() => Promise.resolve(['SAIN'])),
}));

describe('Wordle Component', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('eleanordle:hasSeenTutorial', 'true');
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  const getTodayKey = () => {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const hashToUint32 = (str) => {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  it('defaults to Daily mode and hides reveal option', async () => {
    render(<Wordle />);

    await screen.findByTitle('Eleanordle');

    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(screen.queryByText('Reveal')).not.toBeInTheDocument();
    expect(screen.getByText('Infinite')).toBeInTheDocument();
  });

  it('switches to Practice mode and uses a random word excluding today\'s daily', async () => {
    const { getRandomWord } = require('../services/dictionaryService');

    render(<Wordle />);
    await screen.findByTitle('Eleanordle');

    const dateKey = getTodayKey();
    await waitFor(() => {
      expect(localStorage.getItem(`eleanordle:daily:${dateKey}:targetWord`)).toBeTruthy();
    });
    const dailyWord = localStorage.getItem(`eleanordle:daily:${dateKey}:targetWord`);

    // Switch modes
    fireEvent.click(screen.getByLabelText('Open menu'));
    fireEvent.click(screen.getByText('Infinite'));

    // Practice fetch should be called with the daily word excluded
    expect(getRandomWord).toHaveBeenLastCalledWith([dailyWord], 5);
  });

  it('toggles contrast mode via menu', async () => {
    const { container } = render(<Wordle />);
    await screen.findByTitle('Eleanordle');

    fireEvent.click(screen.getByLabelText('Open menu'));
    fireEvent.click(screen.getByText('Contrast Mode'));

    expect(container.querySelector('.wordle')).toHaveClass('contrast');
  });

  it('masks the target word when it appears in a cached daily clue', async () => {
    const dateKey = getTodayKey();
    const targetWord = DAILY_WORDS[hashToUint32(dateKey) % DAILY_WORDS.length];
    const clueKey = `eleanordle:daily:${dateKey}:clue`;
    const targetKey = `eleanordle:daily:${dateKey}:targetWord`;

    localStorage.setItem('eleanordle:migration:daily-cleanup-v1', 'done');
    localStorage.setItem(targetKey, targetWord);
    localStorage.setItem(clueKey, `This clue says ${targetWord} out loud.`);

    render(<Wordle />);

    expect(await screen.findByText('This clue says ***** out loud.')).toBeInTheDocument();
    expect(localStorage.getItem(clueKey)).toBe('This clue says ***** out loud.');
  });

  it('starts ladder mode at the 4-letter stage with length-aware word selection', async () => {
    const { getRandomWord } = require('../services/dictionaryService');

    getRandomWord.mockReset();
    getRandomWord
      .mockResolvedValueOnce('MOSS')
      .mockResolvedValueOnce('GRAPE')
      .mockResolvedValueOnce('PLANET');

    render(<Wordle />);
    await screen.findByTitle('Eleanordle');

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open menu'));
    });
    fireEvent.click(await screen.findByText('Ladder'));

    await waitFor(() => expect(getRandomWord).toHaveBeenNthCalledWith(1, [], 4));
    expect(getRandomWord).toHaveBeenNthCalledWith(2, expect.any(Array), 5);
    expect(getRandomWord).toHaveBeenNthCalledWith(3, [], 6);
    expect(await screen.findByText('Stage 1 of 3: 4-letter word')).toBeInTheDocument();
    expect(screen.getByLabelText('Wordle guess input')).toHaveAttribute('maxlength', '4');
  });

  it('keeps the intended 4-letter guess under rapid onscreen input', async () => {
    const { getRandomWord } = require('../services/dictionaryService');

    getRandomWord.mockReset();
    getRandomWord
      .mockResolvedValueOnce('MOSS')
      .mockResolvedValueOnce('GRAPE')
      .mockResolvedValueOnce('PLANET');

    render(<Wordle />);
    await screen.findByTitle('Eleanordle');

    fireEvent.click(screen.getByLabelText('Open menu'));
    fireEvent.click(await screen.findByText('Ladder'));
    await screen.findByText('Stage 1 of 3: 4-letter word');

    for (const key of ['N', 'E', 'A', 'T']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    expect(screen.getByLabelText('Wordle guess input')).toHaveValue('NEAT');
  });

  it('returns focus to the hidden input after Suggest Word in ladder mode', async () => {
    const { getRandomWord } = require('../services/dictionaryService');

    getRandomWord.mockReset();
    getRandomWord
      .mockResolvedValueOnce('MOSS')
      .mockResolvedValueOnce('GRAPE')
      .mockResolvedValueOnce('PLANET');

    render(<Wordle />);
    await screen.findByTitle('Eleanordle');

    fireEvent.click(screen.getByLabelText('Open menu'));
    fireEvent.click(await screen.findByText('Ladder'));
    await screen.findByText('Stage 1 of 3: 4-letter word');

    fireEvent.click(screen.getByLabelText('Suggest Word'));

    await waitFor(() => {
      expect(screen.getByLabelText('Wordle guess input')).toHaveValue('SAIN');
    });
    expect(document.activeElement).toBe(screen.getByLabelText('Wordle guess input'));
  });
});
