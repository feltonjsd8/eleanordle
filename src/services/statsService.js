const STATS_KEY_PREFIX = 'eleanordle:stats';
const MODE_DAILY = 'daily';
const MODE_LADDER = 'ladder';

const buildDistribution = (start, end) => {
  const distribution = {};
  for (let guess = start; guess <= end; guess++) {
    distribution[guess] = 0;
  }
  return distribution;
};

const getStatsKey = (mode = MODE_DAILY) => `${STATS_KEY_PREFIX}:${mode}`;

const defaultStats = (mode = MODE_DAILY) => ({
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: mode === MODE_LADDER ? buildDistribution(3, 18) : buildDistribution(1, 6),
  totalGuessesOnWins: 0,
  lastDailyCompleted: null,
});

export const loadStats = (mode = MODE_DAILY) => {
  try {
    const raw = localStorage.getItem(getStatsKey(mode));
    if (!raw) return defaultStats(mode);
    const parsed = JSON.parse(raw);
    const defaults = defaultStats(mode);
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
export const recordGameResult = ({ isSuccess, guessCount, dailyDateKey = null, mode = MODE_DAILY }) => {
  const stats = loadStats(mode);

  // Avoid double-counting if the daily was already recorded.
  if (mode === MODE_DAILY && dailyDateKey && stats.lastDailyCompleted === dailyDateKey) {
    return stats;
  }
  if (mode === MODE_DAILY && dailyDateKey) {
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
    localStorage.setItem(getStatsKey(mode), JSON.stringify(stats));
  } catch {
    // ignore storage errors
  }

  return stats;
};
