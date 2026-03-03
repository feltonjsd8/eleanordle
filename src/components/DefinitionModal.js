
import React from 'react';
import '../styles/DefinitionModal.css';

const DefinitionModal = ({ isOpen, onClose, word, definition }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                {/* Removed modal-header and Definition title for cleaner look */}
                <div className="modal-body">
                    <div className="word-section">
                        <h3>The word is: <span className="highlighted-word">{word}</span></h3>
                        {definition?.phonetic && (
                            <p className="phonetic">{definition.phonetic}</p>
                        )}
                    </div>
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
                    <div className="centered-close-btn">
                        <button className="modal-action-btn close-button" onClick={onClose} autoFocus>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DefinitionModal;
