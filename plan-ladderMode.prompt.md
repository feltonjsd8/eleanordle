## Plan: Ladder Mode 4 to 6

Add a new random Ladder mode that runs three linked rounds in sequence: 4 letters, then 5, then 6. Reuse the existing practice-mode loop where possible, but refactor the game state and dictionary helpers so board width, validation, evaluation, modal content, and stats are driven by the current stage instead of hardcoded to a single 5-letter game. Show an interstitial modal after stage 1 and stage 2, and count only a fully completed ladder as one ladder win.

**Steps**
1. Phase 1: Extract board-size assumptions into reusable helpers in c:\Code\Eleanordle\src\components\Wordle.js. Introduce constants for max guesses and per-stage word lengths, plus a helper that creates empty board state from the active word length. This step blocks later reducer and rendering work because the current reducer, validation, reveal animation, and row persistence all assume a fixed 6x5 board.
2. Phase 1: Add ladder mode identifiers and stage metadata to the reducer state in c:\Code\Eleanordle\src\components\Wordle.js. Include fields for ladder stage index, stage lengths, per-stage completed words/definitions, total guesses across the run, and a modal variant that distinguishes stage-transition interstitials from final game-over results. This depends on step 1.
3. Phase 1: Extend word sourcing in c:\Code\Eleanordle\src\services\dictionaryService.js so getDictionaryWords and getRandomWord accept a target length. Update caching to be keyed by length, update Datamuse patterns to request exact lengths, and add length-specific fallback words for 4, 5, and 6 letters. This can run in parallel with step 2 after the stage lengths are decided.
4. Phase 2: Add a ladder-start path in c:\Code\Eleanordle\src\components\Wordle.js that initializes a random 4-letter stage, excluding the current daily word only for the 5-letter stage to preserve the existing practice-mode behavior. Reuse the current menu/mode toggle area, but expand it from a binary daily/infinite toggle into explicit mode actions so Ladder can be selected without overloading the existing button text. This depends on steps 2 and 3.
5. Phase 2: Refactor gameplay logic in c:\Code\Eleanordle\src\components\Wordle.js so input length checks, guess evaluation, row reveal animation, invalid-word checks, and board rendering all use state.targetWord.length instead of 5. Keep six guesses per stage to align with current stats and UI expectations. On a ladder stage win, open an interstitial modal showing the solved word and definition, then advance to the next stage on confirmation; on the 6-letter win or any stage loss, end the ladder run and mark the mode as game over. This depends on steps 1 through 4.
6. Phase 2: Update modal behavior in c:\Code\Eleanordle\src\components\WordModal.js to support two ladder-specific experiences: a stage-complete interstitial with a Continue action, and a final ladder result with ladder-aware labels. Preserve daily share behavior and existing practice-mode next-word behavior. This depends on step 5.
7. Phase 3: Extend stats handling in c:\Code\Eleanordle\src\services\statsService.js for a separate ladder stats bucket. Count one completed ladder as one played ladder and one win only when all three stages are cleared; losses at any stage count as one played ladder and reset the ladder streak. Track final-run guess distribution using total guesses across the three stages, or add a ladder-specific totalGuessesOnWins-only average if the existing 1-6 distribution is no longer meaningful for this mode. This depends on the ladder completion flow from step 5.
8. Phase 3: Add targeted tests for the new behavior. Update c:\Code\Eleanordle\src\tests\Wordle.test.js for mode selection and ladder progression, c:\Code\Eleanordle\src\tests\stats.test.js for ladder stat isolation and streak rules, and c:\Code\Eleanordle\src\tests\dictionary.test.js for length-aware word fetching and fallback behavior. These can run in parallel once steps 3, 5, and 7 are implemented.
9. Phase 3: Review styling impact in c:\Code\Eleanordle\src\styles\Wordle.css and c:\Code\Eleanordle\src\styles\WordModal.css so 4-letter and 6-letter boards still fit cleanly on mobile and the interstitial modal reads as a stage transition rather than a final game-over screen. This depends on steps 5 and 6.

**Relevant files**
- c:\Code\Eleanordle\src\components\Wordle.js — main reducer, startDailyGame, startPracticeGame, submitGuess, handleNextWord, keyboard input validation, board rendering, and menu mode switching all need Ladder-aware refactors.
- c:\Code\Eleanordle\src\components\WordModal.js — add a stage-transition variant and ladder-specific primary button labels while preserving daily share behavior.
- c:\Code\Eleanordle\src\services\dictionaryService.js — parameterize getDictionaryWords and getRandomWord by word length, and split caches/fallback lists by length.
- c:\Code\Eleanordle\src\services\statsService.js — add a ladder mode stats path and decide how total-guesses reporting maps to the existing stats structure.
- c:\Code\Eleanordle\src\tests\Wordle.test.js — cover ladder mode selection, stage advancement, interstitial modal flow, and final completion/loss behavior.
- c:\Code\Eleanordle\src\tests\stats.test.js — cover one-win-per-completed-ladder rules and ladder streak isolation from daily/practice.
- c:\Code\Eleanordle\src\tests\dictionary.test.js — cover length-specific fetching and fallback validity.
- c:\Code\Eleanordle\src\styles\Wordle.css — ensure the dynamic board width still fits at 4, 5, and 6 letters.
- c:\Code\Eleanordle\src\styles\WordModal.css — support stage-complete versus final-result presentation if the existing modal styling is too final-state specific.

**Verification**
1. Run the existing test suite and confirm no regressions in daily or practice mode behavior.
2. Add or update automated tests to prove a ladder run progresses 4 -> 5 -> 6, opens the interstitial after the first two wins, and records only one final ladder win on full completion.
3. Manually verify mode switching from the menu, including returning from Ladder mode back to Daily and Infinite.
4. Manually verify the board accepts exactly the active stage length, rejects shorter submissions with the correct message, and renders 4-letter and 6-letter rows without layout breakage on desktop and mobile.
5. Manually verify ladder stats are stored separately from daily and practice, with streak changes occurring only at ladder completion or ladder failure.

**Decisions**
- Included scope: one new random Ladder mode, three stages in a fixed 4 -> 5 -> 6 sequence, stage-complete interstitial modal, separate ladder stats bucket.
- Included scope: six guesses per stage unless implementation uncovers a hard UI constraint.
- Excluded scope: daily shared ladder, custom difficulty settings, changes to clue generation beyond making it length-aware, and broad suggestion-service refactors unless Ladder reuses those flows directly.
- Recommendation: if the current 1-6 guessDistribution model becomes misleading for ladder totals above 6, store ladder averages and streaks without forcing them into the same histogram format.

**Further Considerations**
1. If the product wants a share card for completed ladders later, add it as a separate follow-up rather than coupling it to the first implementation.
2. If 4-letter and 6-letter Datamuse quality is inconsistent, switch only Ladder word sourcing to curated local lists while leaving daily word sourcing unchanged.
