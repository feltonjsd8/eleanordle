const STATS_KEY = 'eleanordle:stats';

const defaultStats = () => ({
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  totalGuessesOnWins: 0,
  lastDailyCompleted: null,
});

export const loadStats = () => {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw);
    const defaults = defaultStats();
    return {
      ...defaults,
      ...parsed,
      guessDistribution: { ...defaults.guessDistribution, ...parsed.guessDistribution },
    };
  } catch {
    return defaultStats();
  }
};

/**
 * Record the result of a completed game and persist to localStorage.
 * For daily games pass the dailyDateKey so a reload does not double-count.
 * Returns the updated stats object.
 */
export const recordGameResult = ({ isSuccess, guessCount, dailyDateKey = null }) => {
  const stats = loadStats();

  // Avoid double-counting if the daily was already recorded
  if (dailyDateKey && stats.lastDailyCompleted === dailyDateKey) {
    return stats;
  }
  if (dailyDateKey) {
    stats.lastDailyCompleted = dailyDateKey;
  }

  stats.played += 1;

  if (isSuccess) {
    stats.won += 1;
    stats.currentStreak += 1;
    if (stats.currentStreak > stats.maxStreak) {
      stats.maxStreak = stats.currentStreak;
    }
    const key = String(guessCount);
    stats.guessDistribution[key] = (stats.guessDistribution[key] || 0) + 1;
    stats.totalGuessesOnWins = (stats.totalGuessesOnWins || 0) + guessCount;
  } else {
    stats.currentStreak = 0;
  }

  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore storage errors
  }

  return stats;
};
