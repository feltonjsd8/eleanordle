import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Wordle from '../components/Wordle';

// Mock the dictionary service (daily uses getDictionaryWords)
jest.mock('../services/dictionaryService', () => ({
  getRandomWord: jest.fn(() => Promise.resolve('GRAPE')),
  getDictionaryWords: jest.fn(() => Promise.resolve(['APPLE'])),
  getWordDefinition: jest.fn(() => Promise.resolve({ definitions: [{ definition: 'A fruit' }] })),
  isValidWord: jest.fn(() => Promise.resolve(true)),
}));

describe('Wordle Component', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  const getTodayKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
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
    expect(getRandomWord).toHaveBeenLastCalledWith([dailyWord]);
  });

  it('toggles contrast mode via menu', async () => {
    const { container } = render(<Wordle />);
    await screen.findByTitle('Eleanordle');

    fireEvent.click(screen.getByLabelText('Open menu'));
    fireEvent.click(screen.getByText('Contrast Mode'));

    expect(container.querySelector('.wordle')).toHaveClass('contrast');
  });
});
