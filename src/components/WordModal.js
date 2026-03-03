import React from 'react';
import '../styles/WordModal.css';

const StatsPanel = ({ stats }) => {
    if (!stats) return null;

    const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
    const avgGuesses = stats.won > 0 ? (stats.totalGuessesOnWins / stats.won).toFixed(1) : '—';
    const maxDist = Math.max(1, ...Object.values(stats.guessDistribution));

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
                {[1, 2, 3, 4, 5, 6].map((n) => {
                    const count = stats.guessDistribution[n] || 0;
                    const pct = Math.max(7, Math.round((count / maxDist) * 100));
                    return (
                        <div key={n} className="dist-row">
                            <span className="dist-label">{n}</span>
                            <div className="dist-bar-wrap">
                                <div className="dist-bar" style={{ width: `${pct}%` }}>
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
}) => {
    if (!isOpen) return null;

    const isDaily = gameMode === 'daily';
    const primaryLabel = isDaily ? 'Close' : (isSuccess ? 'Next Word' : 'Try Again');

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className={`modal-header ${isSuccess ? 'success' : 'failure'}`}>
                    <h2>{isSuccess ? 'Congratulations!' : 'Game Over'}</h2>
                </div>
                <div className="modal-body">
                    <div className="word-section">
                        <h3>The word was: <span className="highlighted-word">{word}</span></h3>
                        {definition?.phonetic && (
                            <p className="phonetic">{definition.phonetic}</p>
                        )}
                    </div>

                    <StatsPanel stats={stats} />

                    {isDaily && shareText && (
                        <div className="share-section">
                            <h4 className="share-title">Share</h4>
                            <div className="share-subtitle">Daily {dailyDateKey}</div>
                            <pre className="share-grid" aria-label="Share grid">{shareText}</pre>
                        </div>
                    )}

                    <div className="definitions-section">
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
                    </div>
                </div>
                <div className="modal-footer">
                    {isDaily && (
                        <button className="share-button" onClick={onShare}>
                            Copy
                        </button>
                    )}
                    <button
                        className={isDaily ? 'try-again-button' : (isSuccess ? 'next-word-button' : 'try-again-button')}
                        onClick={onNextWord}
                    >
                        {primaryLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WordModal;
