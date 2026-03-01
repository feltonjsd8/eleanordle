# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:
# Start the development server
# Eleanordle

Eleanordle is a Wordle-inspired word-guessing game included in this React app. Players attempt to guess a hidden word within a limited number of tries. The game provides feedback after each guess to help narrow down the correct answer.

## How to play

- You have 6 attempts to guess the target word.
- Each guess must be a valid word of the same length as the target.
- After submitting a guess, each letter will be marked:
	- Green: correct letter in the correct position.
	- Yellow: correct letter in the wrong position.
	- Gray: letter not present in the word.
- Use the feedback to refine subsequent guesses until you find the word or run out of attempts.

## Game features

- Multiple categories (themes) for target words.
- Keyboard input and on-screen keyboard support.
- Visual, color-coded feedback for each guess.
- A simple modal with word definitions/clues when available.

## Running the app locally

This project is a standard Create React App. From the project root:

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser to play.

## Where to look in the code

- The main game components are in `src/components` (Wordle, WordModal, DefinitionModal).
- Word and suggestion logic is in `src/services`.

## Contributing

If you'd like to add categories, words, or features, please open an issue first or submit a pull request.

## License

MIT
