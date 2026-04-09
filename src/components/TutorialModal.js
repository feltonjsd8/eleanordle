import React, { useState, useEffect } from 'react';
import '../styles/TutorialModal.css';

const TUTORIALS = [
  {
    title: 'Welcome to Eleanordle',
    subtitle: 'A word puzzle game',
    description: 'You have 6 tries to guess a 5-letter word. After each guess, tiles change color to show how close you are.',
  },
  {
    title: 'Guess the Word',
    subtitle: 'Type your first guess',
    description: 'Start with a common 5-letter word. Use the keyboard to type and press ENTER to submit.',
  },
  {
    title: 'Learn from Colors',
    subtitle: 'Read the feedback',
    description: 'Green = correct letter in correct spot\nYellow = correct letter in wrong spot\nGray = letter not in word',
    showExample: true,
    exampleWord: 'REACT',
    exampleGuess: 'STARE',
    exampleEvals: ['incorrect', 'wrong-position', 'wrong-position', 'wrong-position', 'correct'],
  },
  {
    title: 'Use the Clue',
    subtitle: 'Need a hint?',
    description: 'A definition clue appears at the top to help you. You can toggle it on or off anytime.',
  },
  {
    title: 'Keep Guessing',
    subtitle: 'Narrow it down',
    description: 'Use the information from previous guesses to make better guesses. Each guess gets you closer!',
  },
  {
    title: 'Daily, Daily Ladder & Infinite',
    subtitle: 'Three ways to play',
    description: 'Daily: One new puzzle each day, shareable results.\nDaily Ladder: A fixed 4, 5, 6-letter ladder for the day.\nInfinite: Play as many as you want, practice mode.',
  },
  {
    title: 'You\'re Ready!',
    subtitle: 'Start playing',
    description: 'You now know the basics. Good luck, and have fun solving!',
  },
];

const TutorialModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);
  const [revealedTiles, setRevealedTiles] = useState(Array(5).fill(false));

  useEffect(() => {
    if (TUTORIALS[step]?.showExample && isOpen) {
      const timer = setTimeout(() => {
        setRevealedTiles(Array(5).fill(false));
        
        // Animate tiles revealing
        TUTORIALS[step].exampleEvals.forEach((_, idx) => {
          setTimeout(() => {
            setRevealedTiles(prev => {
              const newRevealed = [...prev];
              newRevealed[idx] = true;
              return newRevealed;
            });
          }, idx * 150 + 300);
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step, isOpen]);

  const currentSlide = TUTORIALS[step];
  const isLastStep = step === TUTORIALS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-modal">
        <button className="tutorial-close" onClick={onClose} aria-label="Close tutorial">
          ✕
        </button>

        <div className="tutorial-content">
          <div className="tutorial-header-tiles">
            {('ELEANORDLE').split('').map((letter, idx) => {
              const colors = ['correct', 'wrong-position', 'incorrect'];
              const colorClass = colors[idx % colors.length];
              return (
                <span key={`${letter}-${idx}`} className={`tutorial-tile tutorial-tile--${colorClass}`} aria-hidden="true">
                  {letter}
                </span>
              );
            })}
          </div>
          <h2 className="tutorial-title">{currentSlide.title}</h2>
          <h3 className="tutorial-subtitle">{currentSlide.subtitle}</h3>

          {currentSlide.showExample ? (
            <div className="tutorial-example">
              <div className="example-label">Example: Guess "STARE" when target is "REACT"</div>
              <div className="example-tiles">
                {currentSlide.exampleGuess.split('').map((letter, idx) => (
                  <div
                    key={idx}
                    className={`example-tile ${
                      revealedTiles[idx]
                        ? currentSlide.exampleEvals[idx]
                        : ''
                    } ${revealedTiles[idx] ? 'flip' : ''}`}
                    style={revealedTiles[idx] ? { '--flip-delay': `${idx * 150}ms` } : {}}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <div className="example-legend">
                <div className="legend-item">
                  <span className="legend-tile incorrect">S</span>
                  <span>Not in word</span>
                </div>
                <div className="legend-item">
                  <span className="legend-tile wrong-position">T</span>
                  <span>Wrong position</span>
                </div>
                <div className="legend-item">
                  <span className="legend-tile correct">E</span>
                  <span>Correct position</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="tutorial-description">{currentSlide.description}</p>
          )}
        </div>

        <div className="tutorial-footer">
          <div className="tutorial-steps">
            {TUTORIALS.map((_, idx) => (
              <button
                key={idx}
                className={`step-dot ${idx === step ? 'active' : ''}`}
                onClick={() => setStep(idx)}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <div className="tutorial-buttons">
            <button
              className="tutorial-btn tutorial-btn--secondary"
              onClick={handlePrev}
              disabled={step === 0}
            >
              ← Back
            </button>
            <button
              className="tutorial-btn tutorial-btn--primary"
              onClick={handleNext}
            >
              {isLastStep ? 'Start Playing' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
