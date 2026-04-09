import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Wordle from '../components/Wordle';

jest.mock('../services/dictionaryService', () => ({
  getRandomWord: jest.fn((excludeWords = [], length = 5) => {
    if (length === 4) return Promise.resolve('MOSS');
    if (length === 6) return Promise.resolve('PLANET');
    return Promise.resolve('GRAPE');
  }),
  getDictionaryWords: jest.fn((seed = null, length = 5) => {
    if (length === 4) return Promise.resolve(['MOSS', 'FERN']);
    if (length === 6) return Promise.resolve(['PLANET', 'SPRING']);
    return Promise.resolve(['GRAPE', 'APPLE']);
  }),
  getWordDefinition: jest.fn((word) => Promise.resolve({ word, definitions: [{ definition: `Definition for ${word}` }] })),
  isValidWord: jest.fn(() => Promise.resolve(true)),
  getDailyWordRecord: jest.fn(() => Promise.resolve({ word: 'APPLE', definition: 'Definition for APPLE' })),
  getDailyLadderWords: jest.fn(() => Promise.resolve(['MOSS', 'GRAPE', 'PLANET'])),
}));

jest.mock('../services/suggestionService', () => ({
  getWordFinderSuggestions: jest.fn(() => Promise.resolve(['SAIN'])),
}));

describe('Wordle Component', () => {
  beforeEach(() => {
    const dictionaryService = require('../services/dictionaryService');

    localStorage.clear();
    localStorage.setItem('eleanordle:hasSeenTutorial', 'true');
    jest.clearAllMocks();
    jest.useRealTimers();

    dictionaryService.getRandomWord.mockImplementation((excludeWords = [], length = 5) => {
      if (length === 4) return Promise.resolve('MOSS');
      if (length === 6) return Promise.resolve('PLANET');
      return Promise.resolve('GRAPE');
    });
    dictionaryService.getDictionaryWords.mockImplementation((seed = null, length = 5) => {
      if (length === 4) return Promise.resolve(['MOSS', 'FERN']);
      if (length === 6) return Promise.resolve(['PLANET', 'SPRING']);
      return Promise.resolve(['GRAPE', 'APPLE']);
    });
    dictionaryService.getWordDefinition.mockImplementation((word) => Promise.resolve({ word, definitions: [{ definition: `Definition for ${word}` }] }));
    dictionaryService.isValidWord.mockImplementation(() => Promise.resolve(true));
    dictionaryService.getDailyWordRecord.mockImplementation(() => Promise.resolve({ word: 'APPLE', definition: 'Definition for APPLE' }));
    dictionaryService.getDailyLadderWords.mockImplementation(() => Promise.resolve(['MOSS', 'GRAPE', 'PLANET']));
  });

  const getTodayKey = () => {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
    const targetWord = 'APPLE';
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
    expect(await screen.findByText(/Stage 1 of 3: 4-letter word/)).toBeInTheDocument();
    expect(screen.getByLabelText('Wordle guess input')).toHaveAttribute('maxlength', '4');
  });

  it('starts daily ladder mode with the seeded ladder words and daily restrictions', async () => {
    const { getDailyLadderWords, getRandomWord } = require('../services/dictionaryService');

    render(<Wordle />);
    await screen.findByTitle('Eleanordle');

    fireEvent.click(screen.getByLabelText('Open menu'));
    fireEvent.click(await screen.findByText('Daily Ladder'));

    await screen.findByText(/Daily Ladder: Stage 1 of 3: 4-letter word/);

  expect(getDailyLadderWords).toHaveBeenCalledWith(expect.any(String));
    expect(getRandomWord).not.toHaveBeenCalledWith([], 4);
    expect(screen.getByLabelText('Wordle guess input')).toHaveAttribute('maxlength', '4');
    expect(screen.queryByLabelText('Suggest Word')).not.toBeInTheDocument();
  });

  it('advances daily ladder to the 5-letter stage after completing the 4-letter word', async () => {
    jest.useFakeTimers();

    render(<Wordle />);
    await screen.findByTitle('Eleanordle');

    fireEvent.click(screen.getByLabelText('Open menu'));
    fireEvent.click(await screen.findByText('Daily Ladder'));
    await screen.findByText(/Daily Ladder: Stage 1 of 3: 4-letter word/);

    for (const key of ['M', 'O', 'S', 'S']) {
      fireEvent.click(screen.getByRole('button', { name: key }));
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ENTER' }));
    });

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    const continueButtons = await screen.findAllByRole('button', { name: 'Continue to 5-Letter Word' });

    await act(async () => {
      fireEvent.click(continueButtons[0]);
    });

    await screen.findByText(/Daily Ladder: Stage 2 of 3: 5-letter word/);
    expect(screen.getByLabelText('Wordle guess input')).toHaveAttribute('maxlength', '5');

    jest.useRealTimers();
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
    await screen.findByText(/Stage 1 of 3: 4-letter word/);

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
    await screen.findByText(/Stage 1 of 3: 4-letter word/);

    fireEvent.click(screen.getByLabelText('Suggest Word'));

    await waitFor(() => {
      expect(screen.getByLabelText('Wordle guess input')).toHaveValue('SAIN');
    });
    expect(document.activeElement).toBe(screen.getByLabelText('Wordle guess input'));
  });
});
