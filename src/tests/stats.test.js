import { loadStats, recordGameResult } from '../services/statsService';

describe('statsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadStats returns default values when nothing is stored', () => {
    const stats = loadStats();
    expect(stats.played).toBe(0);
    expect(stats.won).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.maxStreak).toBe(0);
    expect(stats.totalGuessesOnWins).toBe(0);
    expect(stats.guessDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  });

  it('recordGameResult increments played and won on a win', () => {
    const stats = recordGameResult({ isSuccess: true, guessCount: 3 });
    expect(stats.played).toBe(1);
    expect(stats.won).toBe(1);
    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(1);
    expect(stats.guessDistribution[3]).toBe(1);
    expect(stats.totalGuessesOnWins).toBe(3);
  });

  it('recordGameResult increments played but resets streak on a loss', () => {
    recordGameResult({ isSuccess: true, guessCount: 2 });
    const stats = recordGameResult({ isSuccess: false, guessCount: 6 });
    expect(stats.played).toBe(2);
    expect(stats.won).toBe(1);
    expect(stats.currentStreak).toBe(0);
    expect(stats.maxStreak).toBe(1);
  });

  it('maxStreak tracks the highest consecutive wins', () => {
    recordGameResult({ isSuccess: true, guessCount: 1 });
    recordGameResult({ isSuccess: true, guessCount: 2 });
    recordGameResult({ isSuccess: true, guessCount: 3 });
    recordGameResult({ isSuccess: false, guessCount: 6 });
    const stats = recordGameResult({ isSuccess: true, guessCount: 4 });
    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(3);
  });

  it('does not double-count a daily game when called twice with the same dateKey', () => {
    recordGameResult({ isSuccess: true, guessCount: 2, dailyDateKey: '2026-03-01' });
    const stats = recordGameResult({ isSuccess: true, guessCount: 2, dailyDateKey: '2026-03-01' });
    expect(stats.played).toBe(1);
  });

  it('counts a new daily game on a different dateKey', () => {
    recordGameResult({ isSuccess: true, guessCount: 2, dailyDateKey: '2026-03-01' });
    const stats = recordGameResult({ isSuccess: true, guessCount: 3, dailyDateKey: '2026-03-02' });
    expect(stats.played).toBe(2);
    expect(stats.won).toBe(2);
  });

  it('tracks daily and practice stats separately', () => {
    recordGameResult({ isSuccess: true, guessCount: 2, dailyDateKey: '2026-03-01', mode: 'daily' });
    recordGameResult({ isSuccess: false, guessCount: 6, mode: 'practice' });
    recordGameResult({ isSuccess: true, guessCount: 9, mode: 'ladder' });

    const dailyStats = loadStats('daily');
    const practiceStats = loadStats('practice');
    const ladderStats = loadStats('ladder');

    expect(dailyStats.played).toBe(1);
    expect(dailyStats.won).toBe(1);
    expect(dailyStats.guessDistribution[2]).toBe(1);

    expect(practiceStats.played).toBe(1);
    expect(practiceStats.won).toBe(0);
    expect(practiceStats.guessDistribution[2]).toBe(0);

    expect(ladderStats.played).toBe(1);
    expect(ladderStats.won).toBe(1);
    expect(ladderStats.guessDistribution[9]).toBe(1);
  });

  it('persists stats to localStorage', () => {
    recordGameResult({ isSuccess: true, guessCount: 4 });
    const loaded = loadStats();
    expect(loaded.played).toBe(1);
    expect(loaded.guessDistribution[4]).toBe(1);
  });

  it('computes average guesses correctly', () => {
    recordGameResult({ isSuccess: true, guessCount: 2 });
    recordGameResult({ isSuccess: true, guessCount: 4 });
    const stats = loadStats();
    const avg = stats.totalGuessesOnWins / stats.won;
    expect(avg).toBeCloseTo(3);
  });

  it('resets ladder streak only when a ladder run is lost', () => {
    recordGameResult({ isSuccess: true, guessCount: 8, mode: 'ladder' });
    recordGameResult({ isSuccess: true, guessCount: 10, mode: 'ladder' });
    const stats = recordGameResult({ isSuccess: false, guessCount: 12, mode: 'ladder' });

    expect(stats.played).toBe(3);
    expect(stats.won).toBe(2);
    expect(stats.currentStreak).toBe(0);
    expect(stats.maxStreak).toBe(2);
  });
});
