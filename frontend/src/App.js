import React, { useState, useEffect } from 'react';
import './App.css';
import Galaxy from './Galaxy';

const API_URL = 'http://127.0.0.1:8000';

// --- Main App Component ---
function App() {
  const [currentMode, setCurrentMode] = useState('home');

  const renderMode = () => {
    switch (currentMode) {
      case 'adventure':
        return <AdventureMode onBack={() => setCurrentMode('home')} />;
      case 'adaptive':
        return <AdaptiveQuiz onBack={() => setCurrentMode('home')} />;
      case 'generator':
        return <GeneratorMode onBack={() => setCurrentMode('home')} />;
      default:
        return <HomeScreen onModeSelect={setCurrentMode} />;
    }
  };

  return (
    <>
      <Galaxy />
      <div className="App-container">
        {renderMode()}
      </div>
    </>
  );
}

// --- Home Screen Component ---
function HomeScreen({ onModeSelect }) {
  return (
    <div className="home-screen">
      <h1 className="main-title">The Mind's Labyrinth</h1>
      <p className="subtitle">An Interactive Aptitude Challenge</p>
      <div className="mode-selection">
        <div className="mode-card" onClick={() => onModeSelect('adventure')}>
          <h3>Adventure Mode</h3>
          <p>Traverse a fixed path of questions. Demonstrates a **Graph** data structure.</p>
        </div>
        <div className="mode-card" onClick={() => onModeSelect('adaptive')}>
          <h3>Adaptive Quiz</h3>
          <p>Difficulty changes based on your answers. Demonstrates a **Binary Tree**.</p>
        </div>
        <div className="mode-card" onClick={() => onModeSelect('generator')}>
          <h3>Generator Mode</h3>
          <p>Upload a file to create a quiz. Demonstrates a **Stack** for the undo feature.</p>
        </div>
      </div>
    </div>
  );
}


// --- Adventure Mode Component (Graph) ---
function AdventureMode({ onBack }) {
  const [gameState, setGameState] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/adventure`)
      .then(res => res.json())
      .then(data => {
        setGameState(data);
        setIsLoading(false);
      });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue) return;

    fetch(`${API_URL}/api/adventure/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: inputValue }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.result === 'correct') {
          setFeedback('Correct! Moving to the next room...');
          setTimeout(() => {
            fetch(`${API_URL}/api/adventure`)
              .then(res => res.json())
              .then(newData => {
                setGameState(newData);
                setFeedback('');
              });
          }, 1500);
        } else if (data.result === 'finished') {
          setGameState(prev => ({ ...prev, question: null, description: "Congratulations! You have reached the Treasury of Wisdom." }));
          setFeedback('');
        } else {
          setFeedback('Incorrect. The path remains sealed. Please try again.');
        }
      });
    setInputValue('');
  };

  if (isLoading) return <div className="loader"></div>;

  return (
    <div className="game-mode-container">
      <button onClick={onBack} className="back-button">&larr; Back to Menu</button>
      <h2 className="mode-title">Adventure Mode</h2>
      <p className="mode-description">Solve the riddle to traverse the labyrinth. This mode uses a **Graph** to manage rooms.</p>
      <div className="game-board">
        <p className="description">{gameState?.description}</p>
        {gameState?.question && (
          <form onSubmit={handleSubmit} className="answer-form">
            <label className="question-text">{gameState.question}</label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Your answer..."
              autoFocus
            />
            <button type="submit">Submit</button>
          </form>
        )}
        {feedback && <p className="feedback">{feedback}</p>}
      </div>
    </div>
  );
}


// --- Adaptive Quiz Component (Tree) - UPDATED ---
function AdaptiveQuiz({ onBack }) {
    const [currentNodeKey, setCurrentNodeKey] = useState('root');
    const [question, setQuestion] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [quizEnded, setQuizEnded] = useState(false);

    useEffect(() => {
        if (currentNodeKey) {
            setIsLoading(true);
            setQuizEnded(false);
            fetch(`${API_URL}/api/adaptive-quiz/${currentNodeKey}`)
                .then(res => res.json())
                .then(data => {
                    setQuestion(data.question);
                    setIsLoading(false);
                });
        } else {
            setQuizEnded(true);
            setQuestion(null);
            setIsLoading(false);
        }
    }, [currentNodeKey]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputValue) return;

        fetch(`${API_URL}/api/adaptive-quiz/${currentNodeKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer: inputValue }),
        })
        .then(res => res.json())
        .then(data => {
            if (data.result === 'correct') {
                setFeedback('Correct! Moving to the next question...');
                setTimeout(() => {
                    setCurrentNodeKey(data.next_node_key);
                    setFeedback('');
                }, 1500);
            } else {
                setFeedback('Incorrect. Moving to an easier question...');
                 setTimeout(() => {
                    setCurrentNodeKey(data.next_node_key);
                    setFeedback('');
                }, 1500);
            }
        });
        setInputValue('');
    };
    
    if (isLoading) return <div className="loader"></div>;

    return (
        <div className="game-mode-container">
            <button onClick={onBack} className="back-button">&larr; Back to Menu</button>
            <h2 className="mode-title">Adaptive Quiz</h2>
            <p className="mode-description">Answer correctly to get harder questions. This mode uses a **Binary Tree** to adapt the difficulty.</p>
            <div className="game-board">
                {quizEnded ? (
                    <div className="end-message">
                      <h3>Quiz Complete!</h3>
                      <p>You have reached the end of this path. Well done!</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="answer-form">
                        <label className="question-text">{question}</label>
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder="Your answer..."
                          autoFocus
                        />
                        <button type="submit">Submit</button>
                    </form>
                )}
                {feedback && <p className="feedback">{feedback}</p>}
            </div>
        </div>
    );
}


// --- Generator Mode Component (Stack/AI) ---
function GeneratorMode({ onBack }) {
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [visibleHints, setVisibleHints] = useState({});
  const [history, setHistory] = useState([]); // Stack for undo

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError('');
    setQuestions([]);
    setHistory([]);

    const formData = new FormData();
    formData.append('file', file);

    fetch(`${API_URL}/api/generate-questions`, {
      method: 'POST',
      body: formData,
    })
      .then(res => res.ok ? res.json() : res.json().then(err => Promise.reject(err)))
      .then(data => {
        try {
          const parsedQuestions = JSON.parse(data.questions_json);
          setQuestions(parsedQuestions);
          setHistory([{}]); // Initial state for the stack
        } catch (e) { setError('Failed to parse questions from the server.'); }
      })
      .catch(err => setError(err.detail || 'An error occurred during file upload.'))
      .finally(() => setIsLoading(false));
  };

  const handleOptionChange = (qIndex, option) => {
    const newAnswers = { ...userAnswers, [qIndex]: option };
    setHistory(prev => [...prev, newAnswers]); // Push new state to stack
    setUserAnswers(newAnswers);
  };

  const handleUndo = () => {
    if (history.length <= 1) return; // Can't undo initial state
    const newHistory = [...history];
    newHistory.pop(); // Pop from the stack
    setUserAnswers(newHistory[newHistory.length - 1]);
    setHistory(newHistory);
  };

  const checkAnswers = () => {
    let newFeedback = {};
    questions.forEach((q, index) => {
      newFeedback[index] = (userAnswers[index] && userAnswers[index] === q.answer) ? 'correct' : 'incorrect';
    });
    setFeedback(newFeedback);
  };
  
  const toggleHint = (qIndex) => {
    setVisibleHints(prev => ({ ...prev, [qIndex]: !prev[qIndex] }));
  };

  return (
    <div className="game-mode-container">
      <button onClick={onBack} className="back-button">&larr; Back to Menu</button>
      <h2 className="mode-title">Generator Mode</h2>
      <p className="mode-description">
        Upload a file (PDF, DOCX, TXT) to generate a custom quiz based on its content. This mode uses a **Stack** for the 'undo' feature.
      </p>
      
      <div className="upload-section">
          <input type="file" id="file-upload" onChange={handleFileUpload} accept=".pdf,.docx,.txt" disabled={isLoading} />
          <label htmlFor="file-upload" className={`custom-file-upload ${isLoading ? 'disabled' : ''}`}>
            {isLoading ? 'Processing...' : '📁 Choose File'}
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}
        {isLoading && <div className="loader"></div>}

        {questions.length > 0 && (
          <div className="questions-container">
             <button onClick={handleUndo} disabled={history.length <= 1} className="undo-button">Undo Last Answer</button>
            {questions.map((q, qIndex) => (
              <div key={qIndex} className={`question-card ${feedback[qIndex] || ''}`}>
                <div className="question-header">
                  <h3>{qIndex + 1}. {q.question}</h3>
                  <button className="hint-button" onClick={() => toggleHint(qIndex)}>
                    💡 {visibleHints[qIndex] ? 'Hide Hint' : 'Show Hint'}
                  </button>
                </div>

                {visibleHints[qIndex] && (
                  <div className="hint-box">
                    <strong>Hint:</strong> {q.hint}
                  </div>
                )}
                
                <div className="options">
                  {q.options.map((option, oIndex) => (
                    <div key={oIndex} className="option">
                      <input
                        type="radio"
                        id={`q${qIndex}-o${oIndex}`}
                        name={`question-${qIndex}`}
                        value={option}
                        checked={userAnswers[qIndex] === option}
                        onChange={() => handleOptionChange(qIndex, option)}
                      />
                      <label htmlFor={`q${qIndex}-o${oIndex}`}>{option}</label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button className="check-button" onClick={checkAnswers}>Check Answers</button>
          </div>
        )}
    </div>
  );
}

export default App;

