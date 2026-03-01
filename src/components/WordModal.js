import React from 'react';
import '../styles/WordModal.css';

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
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div className="word-section">
                        <h3>The word was: <span className="highlighted-word">{word}</span></h3>
                        {definition?.phonetic && (
                            <p className="phonetic">{definition.phonetic}</p>
                        )}
                    </div>

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
