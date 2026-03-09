import React from 'react';
import '../styles/WordModal.css';

const StatsPanel = ({ stats }) => {
    if (!stats) return null;

    const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
    const avgGuesses = stats.won > 0 ? (stats.totalGuessesOnWins / stats.won).toFixed(1) : '—';
    const distributionKeys = Object.keys(stats.guessDistribution || {}).map(Number).sort((a, b) => a - b);
    const maxDist = Math.max(...Object.values(stats.guessDistribution || { 0: 0 }));
    const maxDistForWidth = Math.max(1, maxDist);

    return (
        <div className="stats-panel">
            <h4 className="stats-heading">STATISTICS</h4>
            <div className="stats-summary">
                <div className="stats-tile">
                    <span className="stats-value">{stats.played}</span>
                    <span className="stats-label">Played</span>
                </div>
                <div className="stats-tile">
                    <span className="stats-value">{winRate}</span>
                    <span className="stats-label">Win&nbsp;%</span>
                </div>
                <div className="stats-tile">
                    <span className="stats-value">{stats.currentStreak}</span>
                    <span className="stats-label">Current<br/>Streak</span>
                </div>
                <div className="stats-tile">
                    <span className="stats-value">{stats.maxStreak}</span>
                    <span className="stats-label">Max<br/>Streak</span>
                </div>
                <div className="stats-tile">
                    <span className="stats-value">{avgGuesses}</span>
                    <span className="stats-label">Avg<br/>Guesses</span>
                </div>
            </div>
            <h4 className="stats-heading">GUESS DISTRIBUTION</h4>
            <div className="stats-distribution">
                {distributionKeys.map((n) => {
                    const count = stats.guessDistribution[n] || 0;
                    const pct = Math.max(7, Math.round((count / maxDistForWidth) * 100));
                    const isLargest = count > 0 && count === maxDist;
                    return (
                        <div key={n} className="dist-row">
                            <span className="dist-label">{n}</span>
                            <div className="dist-bar-wrap">
                                <div className={`dist-bar ${isLargest ? 'dist-bar--max' : ''}`} style={{ width: `${pct}%` }}>
                                    {count}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const WordModal = ({
    isOpen,
    onClose,
    word,
    definition,
    isSuccess,
    onNextWord,
    gameMode,
    dailyDateKey,
    shareText,
    stats,
    onShare,
    variant = 'result',
    title,
    primaryLabel,
    progressLabel,
}) => {
    if (!isOpen) return null;

    const isDaily = gameMode === 'daily';
    const resolvedPrimaryLabel = primaryLabel || (isDaily ? 'Close' : (isSuccess ? 'Next Word' : 'Try Again'));
    const resolvedTitle = title || (isSuccess ? 'Congratulations!' : 'Game Over');
    const showStats = variant === 'result';
    const showDefinitions = Boolean(definition?.definitions?.length);
    const showTopPrimaryAction = gameMode === 'ladder';

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className={`modal-header ${isSuccess ? 'success' : 'failure'}`}>
                    <h2>{resolvedTitle}</h2>
                </div>
                {showTopPrimaryAction && (
                    <div className="modal-top-actions">
                        <button
                            className={isSuccess ? 'next-word-button' : 'try-again-button'}
                            onClick={onNextWord}
                        >
                            {resolvedPrimaryLabel}
                        </button>
                    </div>
                )}
                <div className="modal-body">
                    {progressLabel && <p className="modal-progress-label">{progressLabel}</p>}
                    <div className="word-section">
                        <h3>The word was: <span className="highlighted-word">{word}</span></h3>
                        {definition?.phonetic && (
                            <p className="phonetic">{definition.phonetic}</p>
                        )}
                    </div>

                    {showStats && <StatsPanel stats={stats} />}

                    {showStats && isDaily && shareText && (
                        <div className="share-section">
                            <h4 className="share-title">Share</h4>
                            <div className="share-subtitle">Daily {dailyDateKey}</div>
                            <pre className="share-grid" aria-label="Share grid">{shareText}</pre>
                        </div>
                    )}

                    {showDefinitions && <div className="definitions-section">
                        {definition?.definitions?.map((def, index) => (
                            <div key={index} className="definition-item">
                                {def.partOfSpeech && (
                                    <span className="part-of-speech">{def.partOfSpeech}</span>
                                )}
                                <p className="definition">{def.definition}</p>
                                {def.example && (
                                    <p className="example">Example: "{def.example}"</p>
                                )}
                            </div>
                        ))}
                    </div>}
                </div>
                <div className="modal-footer">
                    {showStats && isDaily && (
                        <button className="share-button" onClick={onShare}>
                            Copy
                        </button>
                    )}
                    <button
                        className={isDaily ? 'try-again-button' : (isSuccess ? 'next-word-button' : 'try-again-button')}
                        onClick={onNextWord}
                    >
                        {resolvedPrimaryLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WordModal;
