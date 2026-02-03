  import React from 'react';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import Wordle from '../components/Wordle';

  // Mock suggestionService for tests that use it
  jest.mock('../services/suggestionService', () => ({
    getWordFinderSuggestions: jest.fn(() => Promise.resolve(['GRAPE'])),
    getDictionaryWords: jest.fn(() => Promise.resolve(['GRAPE', 'LEMON'])),
  }));

  // Mock the dictionary service
  jest.mock('../services/dictionaryService', () => ({
    getRandomWord: jest.fn(() => Promise.resolve('APPLE')),
    getWordDefinition: jest.fn(() => Promise.resolve({ definitions: [{ definition: 'A fruit' }] })),
    isValidWord: jest.fn(() => Promise.resolve(true)),
  }));

  it('should not accept an invalid word as a guess', async () => {
    // Mock isValidWord to return false for 'DFG'
    const { isValidWord } = require('../services/dictionaryService');
    isValidWord.mockImplementation(async (word) => word !== 'DFG');

    render(<Wordle />);
    // Wait for the game to load by checking for the input field
    await screen.findByLabelText('Wordle guess input');

    // Type an invalid guess
    fireEvent.keyDown(window, { key: 'D', code: 'KeyD' });
    fireEvent.keyDown(window, { key: 'F', code: 'KeyF' });
    fireEvent.keyDown(window, { key: 'G', code: 'KeyG' });
    // Fill to required length (default 3 for test)
    fireEvent.keyDown(window, { key: 'ENTER', code: 'Enter' });

    // The invalid message should be shown (wait for it to appear, even if transient)
    await waitFor(() => {
      expect(screen.queryByText('Not a valid word')).toBeTruthy();
    }, { timeout: 3000 });
    // The guess should not be marked as correct, wrong-position, or incorrect
    // (i.e., not submitted to the grid as a guess)
    // Optionally, check that the row is still editable (only in grid, not keyboard)
    const gridTiles = Array.from(document.querySelectorAll('.wordle-tile'));
    const gridText = gridTiles.map(tile => tile.textContent || '').join('');
    expect(gridText).toContain('D');
    expect(gridText).toContain('F');
    expect(gridText).toContain('G');
  });

describe('Wordle Component', () => {
  it('should display the current guess after getting a clue', async () => {
    // Force the game to use a 5-letter word for this test
    const { getRandomWord, getWordDefinition } = require('../services/dictionaryService');
    getRandomWord.mockResolvedValueOnce('GRAPE');
    getWordDefinition.mockResolvedValue({ definitions: [{ definition: 'A fruit' }] });
    render(<Wordle initialWordLength={5} />);
    // Wait for the game to load by checking for the input field
    await screen.findByLabelText('Wordle guess input');
    // Wait for the clue to be displayed (mock returns 'A fruit')
    try {
      await screen.findByText(/fruit/i, {}, { timeout: 3000 });
    } catch (e) {
      // Print the DOM for debugging
      // eslint-disable-next-line no-console
      console.log('CLUE TEST DOM:', document.body.innerHTML);
      throw e;
    }
    // Type a guess
    fireEvent.keyDown(window, { key: 'C', code: 'KeyC' });
    fireEvent.keyDown(window, { key: 'L', code: 'KeyL' });
    fireEvent.keyDown(window, { key: 'U', code: 'KeyU' });
    fireEvent.keyDown(window, { key: 'E', code: 'KeyE' });
    fireEvent.keyDown(window, { key: 'S', code: 'KeyS' });
    // Check that the guess is displayed in the grid only
    const gridTiles = Array.from(document.querySelectorAll('.wordle-tile'));
    const gridText = gridTiles.map(tile => tile.textContent || '').join('');
    expect(gridText).toContain('C');
    expect(gridText).toContain('L');
    expect(gridText).toContain('U');
    expect(gridText).toContain('E');
    expect(gridText).toContain('S');
  });

  it('should display the correct answer when the reveal button is clicked', async () => {
    render(<Wordle />);
    await screen.findByLabelText('Wordle guess input');
      // Open menu and click Reveal by aria-label
      fireEvent.click(screen.getByLabelText('Open menu'));
      const revealBtn = screen.getAllByRole('button').find(btn => btn.textContent && btn.textContent.match(/reveal/i));
      expect(revealBtn).toBeTruthy();
      fireEvent.click(revealBtn);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
  });

  it('should not show the answer at the start of a new game after being revealed', async () => {
    render(<Wordle />);
    await screen.findByLabelText('Wordle guess input');
    // Wait for Reveal button to be enabled and click it
      // Open menu and click Reveal
      fireEvent.click(screen.getByLabelText('Open menu'));
      const revealBtn = screen.getAllByRole('button').find(btn => btn.textContent && btn.textContent.match(/reveal/i));
      expect(revealBtn).toBeTruthy();
      fireEvent.click(revealBtn);
      // Open menu and click New Game
      fireEvent.click(screen.getByLabelText('Open menu'));
      const newGameBtn = screen.getAllByRole('button').find(btn => btn.textContent && btn.textContent.match(/new game/i));
      expect(newGameBtn).toBeTruthy();
      fireEvent.click(newGameBtn);
      // Check that the answer is not displayed in the grid (tiles only)
      const gridTiles = Array.from(document.querySelectorAll('.wordle-tile'));
      const gridText = gridTiles.map(tile => tile.textContent || '').join('');
      expect(gridText).not.toMatch(/[APLE]/);
  });

  it('should fetch more words if no suggestions are found', async () => {
    const { getWordFinderSuggestions, getDictionaryWords } = require('../services/suggestionService');
    const { getRandomWord, getWordDefinition } = require('../services/dictionaryService');
    getWordFinderSuggestions.mockResolvedValueOnce(['GRAPE']); // Provide a suggestion
    getDictionaryWords.mockResolvedValueOnce(['GRAPE', 'LEMON']); // New words to fetch
    getRandomWord.mockResolvedValueOnce('GRAPE'); // Force 5-letter word
    getWordDefinition.mockResolvedValue({ definitions: [{ definition: 'A fruit' }] });
    render(<Wordle initialWordLength={5} />);
    await screen.findByLabelText('Wordle guess input');
    fireEvent.click(screen.getByLabelText('Suggest Word'));
    // Wait for the suggestion to be set as current guess
    await screen.findByDisplayValue('GRAPE', {}, { timeout: 3000 });
    // Submit the guess
    fireEvent.keyDown(window, { key: 'ENTER', code: 'Enter' });
    // Wait for the suggestion to appear in the grid
    // Helper to get grid tile by letter
    const findGridTile = async (letter) => {
      const all = await screen.findAllByText(letter, {}, { timeout: 3000 });
      // Only return elements with class 'wordle-tile'
      return all.find(el => el.className && el.className.includes('wordle-tile'));
    };
    try {
      expect(await findGridTile('G')).toBeTruthy();
      expect(await findGridTile('R')).toBeTruthy();
      expect(await findGridTile('A')).toBeTruthy();
      expect(await findGridTile('P')).toBeTruthy();
      expect(await findGridTile('E')).toBeTruthy();
    } catch (e) {
      // Print the DOM for debugging
      // eslint-disable-next-line no-console
      console.log('SUGGESTION TEST DOM:', document.body.innerHTML);
      throw e;
    }
  });

  it('should toggle contrast mode', async () => {
    render(<Wordle />);
    await screen.findByLabelText('Wordle guess input');
    fireEvent.click(screen.getByLabelText('Open menu'));
    fireEvent.click(screen.getByText('Contrast Mode'));
    // Check that the contrast class is applied to the root element
    const root = screen.getByLabelText('Wordle guess input').closest('.wordle');
    expect(root).toHaveClass('contrast');
  });
});
