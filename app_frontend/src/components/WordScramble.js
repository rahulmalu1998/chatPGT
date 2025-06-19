import React, { useState, useEffect } from 'react';
import './WordScramble.css';

function WordScramble({ sentence, onComplete }) {
  const [words, setWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  
  // Initialize the game with scrambled words
  useEffect(() => {
    if (sentence) {
      // Split sentence into words and remove punctuation
      const wordsArray = sentence.split(/\s+/).map(word => 
        word.replace(/[.,!?;:'"()]/g, '')
      ).filter(word => word.length > 0);
      
      // Shuffle the words
      const shuffled = [...wordsArray].sort(() => Math.random() - 0.5);
      setWords(shuffled);
      setSelectedWords([]);
      setIsCorrect(null);
    }
  }, [sentence]);
  
  // Handle word selection
  const handleWordClick = (word, index) => {
    // Add word to selected words
    setSelectedWords([...selectedWords, { word, originalIndex: index }]);
    
    // Remove word from available words
    setWords(words.filter((_, i) => i !== index));
    
    // Check if all words have been selected
    if (selectedWords.length === sentence.split(/\s+/).length - 1) {
      checkAnswer([...selectedWords, { word, originalIndex: index }]);
    }
  };
  
  // Handle removing a selected word
  const handleRemoveWord = (index) => {
    // Get the word to remove
    const removedWord = selectedWords[index];
    
    // Add it back to the words array
    setWords([...words, removedWord.word]);
    
    // Remove from selected words
    setSelectedWords(selectedWords.filter((_, i) => i !== index));
    
    // Reset correctness state
    setIsCorrect(null);
  };
  
  // Check if the answer is correct
  const checkAnswer = (selected) => {
    const originalSentence = sentence.replace(/[.,!?;:'"()]/g, '').toLowerCase();
    const userSentence = selected.map(item => item.word).join(' ').toLowerCase();
    
    setIsCorrect(originalSentence === userSentence);
    
    if (originalSentence === userSentence) {
      setTimeout(() => {
        onComplete && onComplete(true);
      }, 1500);
    }
  };
  
  // Reset the game
  const resetGame = () => {
    const wordsArray = sentence.split(/\s+/).map(word => 
      word.replace(/[.,!?;:'"()]/g, '')
    ).filter(word => word.length > 0);
    
    setWords([...wordsArray].sort(() => Math.random() - 0.5));
    setSelectedWords([]);
    setIsCorrect(null);
  };
  
  return (
    <div className="word-scramble">
      <div className="word-scramble-instructions">
        Arrange the words to form a correct sentence:
      </div>
      
      <div className="word-scramble-selected">
        {selectedWords.map((item, index) => (
          <button 
            key={`selected-${index}`} 
            className="word-button selected"
            onClick={() => handleRemoveWord(index)}
          >
            {item.word}
          </button>
        ))}
      </div>
      
      <div className="word-scramble-available">
        {words.map((word, index) => (
          <button 
            key={`available-${index}`} 
            className="word-button"
            onClick={() => handleWordClick(word, index)}
          >
            {word}
          </button>
        ))}
      </div>
      
      {isCorrect !== null && (
        <div className={`word-scramble-result ${isCorrect ? 'correct' : 'incorrect'}`}>
          {isCorrect ? 'Correct! Well done!' : 'Not quite right. Try again!'}
          {!isCorrect && (
            <button className="reset-button" onClick={resetGame}>
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default WordScramble;