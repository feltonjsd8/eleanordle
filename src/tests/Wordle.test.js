import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Wordle from '../components/Wordle';

// Mock the dictionary service
jest.mock('../services/dictionaryService', () => ({
  getRandomWord: jest.fn(() => Promise.resolve('APPLE')),
  getWordDefinition: jest.fn(() => Promise.resolve({ definitions: [{ definition: 'A fruit' }] })),
  isValidWord: jest.fn(() => Promise.resolve(true)),
}));

describe('Wordle Component', () => {
  it('should display the current guess after getting a clue', async () => {
    render(<Wordle />);

    // Wait for the game to load
    await screen.findByText('Eleanordle');

    // Click the clue button
    fireEvent.click(screen.getByLabelText('Get Clue'));

    // Wait for the clue to be displayed
    await screen.findByText('Clue: A fruit');

    // Type a guess
    fireEvent.keyDown(window, { key: 'C', code: 'KeyC' });
    fireEvent.keyDown(window, { key: 'L', code: 'KeyL' });
    fireEvent.keyDown(window, { key: 'U', code: 'KeyU' });
    fireEvent.keyDown(window, { key: 'E', code: 'KeyE' });

    // Check that the guess is displayed
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('should display the correct answer when the reveal button is clicked', async () => {
    render(<Wordle />);

    // Wait for the game to load
    await screen.findByText('Eleanordle');

    // Click the reveal button
    fireEvent.click(screen.getByText('Reveal'));

    // Check that the correct answer is displayed
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('should not show the answer at the start of a new game after being revealed', async () => {
    render(<Wordle />);

    // Wait for the game to load
    await screen.findByText('Eleanordle');

    // Click the reveal button
    fireEvent.click(screen.getByText('Reveal'));

    // Start a new game
    fireEvent.click(screen.getByText('New Game'));

    // Check that the answer is not displayed
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.queryByText('P')).not.toBeInTheDocument();
    expect(screen.queryByText('L')).not.toBeInTheDocument();
    expect(screen.queryByText('E')).not.toBeInTheDocument();
  });

  it('should fetch more words if no suggestions are found', async () => {
    const { getWordFinderSuggestions, getDictionaryWords } = require('../services/suggestionService');
    getWordFinderSuggestions.mockResolvedValueOnce([]); // No initial suggestions
    getDictionaryWords.mockResolvedValueOnce(['GRAPE', 'LEMON']); // New words to fetch

    render(<Wordle />);

    // Wait for the game to load
    await screen.findByText('Eleanordle');

    // Click the suggest word button
    fireEvent.click(screen.getByLabelText('Suggest Word'));

    // Check that a new suggestion is displayed
    expect(await screen.findByText('G')).toBeInTheDocument();
    expect(await screen.findByText('R')).toBeInTheDocument();
    expect(await screen.findByText('A')).toBeInTheDocument();
    expect(await screen.findByText('P
')).toBeInTheDocument();
    expect(await screen.findByText('E')).toBeInTheDocument();
  });

  it('should toggle contrast mode', async () => {
    render(<Wordle />);

    // Wait for the game to load
    await screen.findByText('Eleanordle');

    // Click the burger menu button
    fireEvent.click(screen.getByLabelText('Open menu'));

    // Click the contrast mode button
    fireEvent.click(screen.getByText('Contrast Mode'));

    // Check that the contrast class is applied
    expect(screen.getByText('Eleanordle').parentElement.parentElement.parentElement).toHaveClass('contrast');
  });
});
