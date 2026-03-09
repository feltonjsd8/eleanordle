import React from 'react';
import { render, screen } from '@testing-library/react';
import WordModal from '../components/WordModal';

describe('WordModal', () => {
  it('leaves the answer word visible in modal definitions and examples', () => {
    render(
      <WordModal
        isOpen
        onClose={() => {}}
        onNextWord={() => {}}
        onShare={() => {}}
        word="BLUFF"
        isSuccess={false}
        gameMode="practice"
        definition={{
          definitions: [
            {
              partOfSpeech: 'noun',
              definition: 'A bluff can be a deceptive act.',
              example: 'They tried to bluff their way through.',
            },
          ],
        }}
      />
    );

    expect(screen.getByText('A bluff can be a deceptive act.')).toBeInTheDocument();
    expect(screen.getByText('Example: "They tried to bluff their way through."')).toBeInTheDocument();
    expect(screen.queryByText('A ***** can be a deceptive act.')).not.toBeInTheDocument();
  });

  it('shows ladder primary actions at the top of the modal', () => {
    const { container } = render(
      <WordModal
        isOpen
        onClose={() => {}}
        onNextWord={() => {}}
        onShare={() => {}}
        word="GRAPE"
        isSuccess
        gameMode="ladder"
        primaryLabel="Continue to 6-Letter Word"
        definition={{ definitions: [] }}
      />
    );

    const topActions = container.querySelector('.modal-top-actions');

    expect(topActions).not.toBeNull();
    expect(topActions).toContainElement(screen.getAllByRole('button', { name: 'Continue to 6-Letter Word' })[0]);
  });
});