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
});
