import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Routes, Route, Link } from 'react-router-dom';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  Firestore,
  query,
  where,
  getDoc
} from 'firebase/firestore';
import './App.css';

interface Answer {
  id: string;
  text: string;
}

interface Question {
  id: string;
  title: string;
  type: 'single-choice' | 'text-input';
  answers: Answer[];
}

interface FunnelData {
  questions: Question[];
  finalRedirectLink: string;
  tracking: string;
  conversionGoal: string;
  primaryColor: string;
  buttonColor: string;
  backgroundColor: string;
  textColor: string;
}

interface Funnel {
  id: string; // Document ID in Firestore
  name: string; // Funnel name
  data: FunnelData;
}

// Props for the main App component, now accepting db from index.tsx
interface AppProps {
  db: Firestore;
}

const defaultFunnelData: FunnelData = {
  questions: [],
  finalRedirectLink: '',
  tracking: '',
  conversionGoal: 'Product Purchase',
  primaryColor: '#007bff',
  buttonColor: '#28a745',
  backgroundColor: '#f8f9fa',
  textColor: '#333333',
};


export default function App({ db }: AppProps) { // db is received here
  const navigate = useNavigate();

  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const funnelsCollectionRef = collection(db, 'funnels'); // This is correct, db is in scope

  const getFunnels = useCallback(async () => {
    try {
      const data = await getDocs(funnelsCollectionRef);
      const loadedFunnels = data.docs.map((doc) => {
        const docData = doc.data() as Partial<Funnel>;
        const funnelWithDefaultData: Funnel = {
          ...(docData as Funnel),
          id: doc.id,
          data: { ...defaultFunnelData, ...docData.data },
        };
        return funnelWithDefaultData;
      });

      const hasMigrated = localStorage.getItem('hasMigratedToFirestore');
      const oldQuizQuestions = localStorage.getItem('quizQuestions');
      const oldAffiliateLinks = localStorage.getItem('affiliateLinks');

      if (!hasMigrated && oldQuizQuestions && oldAffiliateLinks) {
        const parsedOldQuestions: Question[] = JSON.parse(oldQuizQuestions);
        const parsedOldLinks = JSON.parse(oldAffiliateLinks);

        if (parsedOldQuestions.length > 0) {
          console.log("Migrating old local storage data to Firestore...");
          const migratedFunnelData: FunnelData = {
            ...defaultFunnelData,
            questions: parsedOldQuestions,
            finalRedirectLink: parsedOldLinks.finalRedirectLink || '',
            tracking: parsedOldLinks.tracking || '',
            conversionGoal: parsedOldLinks.conversionGoal || 'Product Purchase',
          };
          await addDoc(funnelsCollectionRef, { name: "Migrated Funnel (from LocalStorage)", data: migratedFunnelData });
          localStorage.setItem('hasMigratedToFirestore', 'true');
          alert('Old quiz data migrated to Firestore! Please refresh.');
          window.location.reload();
        }
      }

      setFunnels(loadedFunnels);
    } catch (error) {
      console.error("Error fetching funnels:", error);
      alert("Failed to load funnels from database. Check console for details.");
    }
  }, [funnelsCollectionRef]);

  useEffect(() => {
    getFunnels();
  }, [getFunnels]);

  const createFunnel = async (name: string) => {
    try {
      const newFunnelRef = await addDoc(funnelsCollectionRef, {
        name: name,
        data: defaultFunnelData,
      });
      alert(`Funnel "${name}" created!`);
      getFunnels();
      navigate(`/edit/${newFunnelRef.id}`);
    } catch (error) {
      console.error("Error creating funnel:", error);
      alert("Failed to create funnel. Check console for details.");
    }
  };

  const deleteFunnel = async (funnelId: string) => {
    if (window.confirm("Are you sure you want to delete this funnel? This action cannot be undone.")) {
      try {
        const funnelDoc = doc(db, 'funnels', funnelId);
        await deleteDoc(funnelDoc);
        alert('Funnel deleted!');
        getFunnels();
        navigate('/');
      } catch (error) {
        console.error("Error deleting funnel:", error);
        alert("Failed to delete funnel. Check console for details.");
      }
    }
  };

  const updateFunnelData = async (funnelId: string, newData: FunnelData) => {
    try {
      const funnelDoc = doc(db, 'funnels', funnelId);
      await updateDoc(funnelDoc, { data: newData });
      console.log("FunnelEditor: Data saved to Firestore successfully for funnel:", funnelId);
      alert('Funnel data saved to cloud!');
      getFunnels();
    } catch (error) {
      console.error("Error updating funnel:", error);
      alert("Failed to save funnel data to cloud. Check console for details.");
    }
  };

  return (
    <Routes>
      {/* NEW: Pass db prop to FunnelDashboard */}
      <Route path="/" element={<FunnelDashboard db={db} funnels={funnels} createFunnel={createFunnel} deleteFunnel={deleteFunnel} />} />
      <Route path="/edit/:funnelId" element={<FunnelEditor db={db} updateFunnelData={updateFunnelData} />} />
      <Route path="/play/:funnelId" element={<QuizPlayer db={db} />} />
      <Route path="*" element={<h2>404 Not Found</h2>} />
    </Routes>
  );
}

// FunnelDashboard Component
interface FunnelDashboardProps {
  db: Firestore; // NEW: db prop added
  funnels: Funnel[];
  createFunnel: (name: string) => Promise<void>;
  deleteFunnel: (funnelId: string) => Promise<void>;
}

const FunnelDashboard: React.FC<FunnelDashboardProps> = ({ db, funnels, createFunnel, deleteFunnel }) => { // NEW: db received here
  const [newFunnelName, setNewFunnelName] = useState('');
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch funnels on mount and when create/delete happens
  useEffect(() => {
    const fetchFunnels = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Correctly use db from props
        const funnelsCollectionRef = collection(db, 'funnels');
        const data = await getDocs(funnelsCollectionRef);
        const loadedFunnels = data.docs.map((doc) => {
          const docData = doc.data() as Partial<Funnel>;
          const funnelWithDefaultData: Funnel = {
            ...(docData as Funnel),
            id: doc.id,
            data: { ...defaultFunnelData, ...docData.data },
          };
          return funnelWithDefaultData;
        });
        setFunnels(loadedFunnels);
      } catch (err) {
        console.error("Error fetching funnels in dashboard:", err);
        setError("Failed to load funnels. Please check your internet connection and Firebase rules.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchFunnels();
  }, [db, createFunnel, deleteFunnel]); // NEW: db added to dependency array

  const handleCreateFunnel = async () => {
    if (!newFunnelName.trim()) {
      alert('Please enter a funnel name.');
      return;
    }
    setIsLoading(true);
    try {
      await createFunnel(newFunnelName);
      setNewFunnelName('');
    } catch (err) {
      setError("Failed to create funnel. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFunnel = async (funnelId: string) => {
    setIsLoading(true);
    try {
      await deleteFunnel(funnelId);
    } catch (err) {
      setError("Failed to delete funnel. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="dashboard-container">
      <h2><span role="img" aria-label="funnel">🥞</span> Your Funnels</h2>
      <div className="create-funnel-section">
        <input
          type="text"
          placeholder="New Funnel Name"
          value={newFunnelName}
          onChange={(e) => setNewFunnelName(e.target.value)}
          className="funnel-name-input"
        />
        <button className="add-button" onClick={handleCreateFunnel} disabled={isLoading}>
          <span role="img" aria-label="add">➕</span> Create New Funnel
        </button>
      </div>

      {isLoading ? (
        <p className="loading-message">Loading funnels...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : funnels.length === 0 ? (
        <p className="no-funnels-message">No funnels created yet. Start by creating one!</p>
      ) : (
        <ul className="funnel-list">
          {funnels.map((funnel) => (
            <li key={funnel.id} className="funnel-item">
              <span>{funnel.name}</span>
              <div className="funnel-actions">
                <button className="button-link" onClick={() => navigate(`/edit/${funnel.id}`)}>
                  Edit
                </button>
                <button className="button-link" onClick={() => navigate(`/play/${funnel.id}`)}>
                  Play
                </button>
                <button className="button-link" onClick={() => handleCopyLink(funnel.id)}>
                  Copy Link
                </button>
                <button className="button-link delete-button" onClick={() => handleDeleteFunnel(funnel.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// FunnelEditor (now for editing a specific funnel's quiz & links)
interface FunnelEditorProps {
  db: Firestore;
  updateFunnelData: (funnelId: string, newData: FunnelData) => Promise<void>;
}

const FunnelEditor: React.FC<FunnelEditorProps> = ({ db, updateFunnelData }) => {
  const { funnelId } = useParams<{ funnelId: string }>();
  const navigate = useNavigate();

  const [funnelName, setFunnelName] = useState('Loading...');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [finalRedirectLink, setFinalRedirectLink] = useState('');
  const [tracking, setTracking] = useState('');
  const [conversionGoal, setConversionGoal] = useState('Product Purchase');
  // States for colors
  const [primaryColor, setPrimaryColor] = useState(defaultFunnelData.primaryColor);
  const [buttonColor, setButtonColor] = useState(defaultFunnelData.buttonColor);
  const [backgroundColor, setBackgroundColor] = useState(defaultFunnelData.backgroundColor);
  const [textColor, setTextColor] = useState(defaultFunnelData.textColor);

  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [currentSubView, setCurrentSubView] = useState('mainEditorDashboard');

  const [debugLinkValue, setDebugLinkValue] = useState('Debug: N/A');


  // Load specific funnel data when component mounts or funnelId changes
  useEffect(() => {
    const getFunnel = async () => {
      if (!funnelId) return;
      const funnelDocRef = doc(db, 'funnels', funnelId);
      const funnelDoc = await getDoc(funnelDocRef);
      if (funnelDoc.exists()) {
        const funnel = funnelDoc.data() as Funnel;
        setFunnelName(funnel.name);
        setQuestions(funnel.data.questions || defaultFunnelData.questions);
        setFinalRedirectLink(funnel.data.finalRedirectLink || defaultFunnelData.finalRedirectLink);
        setTracking(funnel.data.tracking || defaultFunnelData.tracking);
        setConversionGoal(funnel.data.conversionGoal || defaultFunnelData.conversionGoal);
        setPrimaryColor(funnel.data.primaryColor || defaultFunnelData.primaryColor);
        setButtonColor(funnel.data.buttonColor || defaultFunnelData.buttonColor);
        setBackgroundColor(funnel.data.backgroundColor || defaultFunnelData.backgroundColor);
        setTextColor(funnel.data.textColor || defaultFunnelData.textColor);

        const loadedLink = funnel.data.finalRedirectLink || 'Empty';
        setDebugLinkValue(`Loaded: ${loadedLink}`);
        console.log("FunnelEditor: Loaded finalRedirectLink from Firestore:", loadedLink);
      } else {
        alert('Funnel not found!');
        navigate('/');
      }
    };
    getFunnel();
  }, [funnelId, db, navigate]);

  // Save funnel data to Firestore whenever relevant states change
  const saveFunnelToFirestore = useCallback(() => {
    if (!funnelId) return;
    const newData: FunnelData = {
      questions,
      finalRedirectLink,
      tracking,
      conversionGoal,
      primaryColor,
      buttonColor,
      backgroundColor,
      textColor,
    };
    setDebugLinkValue(`Saving: ${finalRedirectLink || 'Empty'}`);
    console.log("FunnelEditor: Saving finalRedirectLink to Firestore:", finalRedirectLink);
    updateFunnelData(funnelId, newData);
  }, [funnelId, questions, finalRedirectLink, tracking, conversionGoal,
      primaryColor, buttonColor, backgroundColor, textColor, updateFunnelData]);

  useEffect(() => {
    const handler = setTimeout(() => {
      saveFunnelToFirestore();
    }, 1000);
    return () => clearTimeout(handler);
  }, [questions, finalRedirectLink, tracking, conversionGoal,
      primaryColor, buttonColor, backgroundColor, textColor, saveFunnelToFirestore]);


  const handleAddQuestion = () => {
    if (questions.length >= 6) {
      alert('You can only have up to 6 questions for this quiz.');
      return;
    }
    const newQuestion: Question = {
      id: Date.now().toString(),
      title: `New Question ${questions.length + 1}`,
      type: 'single-choice',
      answers: Array(4).fill(null).map((_, i) => ({ id: `option-${Date.now()}-${i}`, text: `Option ${String.fromCharCode(65 + i)}` })),
    };
    setQuestions([...questions, newQuestion]);
    setSelectedQuestionIndex(questions.length);
    setCurrentSubView('questionForm');
  };

  const handleEditQuestion = (index: number) => {
    setSelectedQuestionIndex(index);
    setCurrentSubView('questionForm');
  };

  const handleDeleteQuestion = () => {
    if (selectedQuestionIndex !== null && window.confirm('Are you sure you want to delete this question?')) {
      const updatedQuestions = questions.filter((_, i) => i !== selectedQuestionIndex);
      setQuestions(updatedQuestions);
      setSelectedQuestionIndex(null);
      setCurrentSubView('quizEditorList');
    }
  };

  const handleQuestionFormSave = (updatedQuestion: Question) => {
    if (!updatedQuestion.title.trim()) {
      alert('Question title cannot be empty!');
      return;
    }
    const filteredAnswers = updatedQuestion.answers.filter(ans => ans.text.trim() !== '');
    if (filteredAnswers.length === 0) {
        alert('Please provide at least one answer option.');
        return;
    }
    updatedQuestion.answers = filteredAnswers;

    onSave({
      id: question?.id || Date.now().toString(),
      title,
      type: 'single-choice',
      answers: filteredAnswers,
    });
  };

  const handleQuestionFormCancel = () => {
    setSelectedQuestionIndex(null);
    setCurrentSubView('quizEditorList');
  };

  const renderEditorContent = () => {
    switch (currentSubView) {
      case 'quizEditorList':
        return (
          <QuizEditorComponent
            questions={questions}
            onAddQuestion={handleAddQuestion}
            onEditQuestion={handleEditQuestion}
            onBack={() => setCurrentSubView('mainEditorDashboard')}
            onImportQuestions={handleImportQuestions}
          />
        );
      case 'questionForm':
        const questionToEdit = selectedQuestionIndex !== null ? questions[selectedQuestionIndex] : undefined;
        return (
          <QuestionFormComponent
            question={questionToEdit}
            questionIndex={selectedQuestionIndex}
            onSave={handleQuestionFormSave}
            onCancel={handleQuestionFormCancel}
            onDelete={handleDeleteQuestion}
          />
        );
      case 'linkSettings':
        return (
          <LinkSettingsComponent
            finalRedirectLink={finalRedirectLink}
            setFinalRedirectLink={setFinalRedirectLink}
            tracking={tracking}
            setTracking={setTracking}
            conversionGoal={conversionGoal}
            setConversionGoal={setConversionGoal}
            onBack={() => setCurrentSubView('mainEditorDashboard')}
          />
        );
      case 'colorCustomizer':
        return (
          <ColorCustomizerComponent
            primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
            buttonColor={buttonColor} setButtonColor={setButtonColor}
            backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor}
            textColor={textColor} setTextColor={setTextColor}
            onBack={() => setCurrentSubView('mainEditorDashboard')}
          />
        );
      default: // mainEditorDashboard
        return (
          <div className="dashboard-container">
            <h2><span role="img" aria-label="funnel">🥞</span> {funnelName} Editor</h2>
            <p>Manage components for this funnel.</p>

            <div className="dashboard-card" onClick={() => setCurrentSubView('quizEditorList')}>
              <h3><span role="img" aria-label="quiz">📝</span> Interactive Quiz Builder</h3>
              <p>Manage quiz questions for this funnel.</p>
            </div>

            <div className="dashboard-card" onClick={() => setCurrentSubView('linkSettings')}>
              <h3><span role="img" aria-label="link">🔗</span> Final Redirect Link Settings</h3>
              <p>Configure the custom link where users will be redirected.</p>
            </div>

            <div className="dashboard-card" onClick={() => setCurrentSubView('colorCustomizer')}>
              <h3><span role="img" aria-label="palette">🎨</span> Color Customization</h3>
              <p>Customize theme colors for this funnel.</p>
            </div>

            <button className="back-button" onClick={() => navigate('/')}>
              <span role="img" aria-label="back">←</span> Back to All Funnels
            </button>
            {/* Debugging info for finalRedirectLink */}
            <div style={{ marginTop: '20px', padding: '10px', border: '1px dashed #ccc', fontSize: '0.8em', wordBreak: 'break-all', textAlign: 'left' }}>
                <strong>DEBUG:</strong> {debugLinkValue}
            </div>
          </div>
        );
    }
  };

  // NEW: handleImportQuestions function
  const handleImportQuestions = (importedQuestions: Question[]) => {
    // Check if adding imported questions would exceed the 6-question limit
    if (questions.length + importedQuestions.length > 6) {
      alert(`Cannot import. This funnel already has ${questions.length} questions. Importing ${importedQuestions.length} more would exceed the 6-question limit.`);
      return;
    }
    // Filter out questions that don't have a title or any answers, or answers without text
    const validImportedQuestions = importedQuestions.filter(q => 
        q.title && q.title.trim() !== '' && 
        Array.isArray(q.answers) && q.answers.length > 0 &&
        !q.answers.some(a => !a.text || a.text.trim() === '')
    );

    if (validImportedQuestions.length === 0) {
        alert('No valid questions found in the imported file. Please check the file format (title and answer text are required).');
        return;
    }

    setQuestions(prevQuestions => [...prevQuestions, ...validImportedQuestions]);
    alert(`Successfully imported ${validImportedQuestions.length} questions!`);
  };


  return (
    <div className="App">
      {renderEditorContent()}
    </div>
  );
}

interface QuizPlayerProps {
  db: Firestore;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ db }) => {
  const { funnelId } = useParams<{ funnelId: string }>();
  const navigate = useNavigate();

  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [clickedAnswerIndex, setClickedAnswerIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const getFunnelForPlay = async () => {
      if (!funnelId) {
        setError('No funnel ID provided!');
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const funnelDocRef = doc(db, 'funnels', funnelId);
        const funnelDoc = await getDoc(funnelDocRef);
        if (funnelDoc.exists()) {
          const funnel = funnelDoc.data() as Funnel;
          setFunnelData({ ...defaultFunnelData, ...funnel.data });
          console.log("QuizPlayer: Loaded funnel data for play:", funnel.data);
          console.log("QuizPlayer: Loaded finalRedirectLink for play:", funnel.data.finalRedirectLink);
        } else {
          setError('Funnel not found! Please check the link or contact the funnel creator.');
        }
      } catch (err) {
        console.error("Error loading funnel for play:", err);
        setError("Failed to load quiz. Please check your internet connection and Firebase rules.");
      } finally {
        setIsLoading(false);
      }
    };
    getFunnelForPlay();
  }, [funnelId, db, navigate]);

  const handleAnswerClick = (answerIndex: number) => {
    if (isAnimating || !funnelData) return;

    setIsAnimating(true);
    setClickedAnswerIndex(answerIndex);

    setTimeout(() => {
      setIsAnimating(false);
      setClickedAnswerIndex(null);

      if (!funnelData || funnelData.questions.length === 0) return;

      if (currentQuestionIndex === 5 && funnelData.questions.length === 6) {
        let redirectLink = funnelData.finalRedirectLink || "https://example.com/default-final-redirect-link";

        if (funnelData.tracking && funnelData.tracking.trim() !== '') {
          const hasQueryParams = redirectLink.includes('?');
          redirectLink = `${redirectLink}${hasQueryParams ? '&' : '?'}${funnelData.tracking.trim()}`;
        }

        console.log("QuizPlayer: Attempting redirect to:", redirectLink);
        window.location.href = redirectLink;
        return;
      }

      if (currentQuestionIndex < funnelData.questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        alert('Quiz complete! No more questions.');
      }
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="quiz-player-container">
        <h2>Loading Quiz...</h2>
        <p>Please wait while your quiz loads.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-player-container">
        <h2>Error Loading Quiz</h2>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  if (funnelData.questions.length === 0 || funnelData.questions.length < 6) {
    return (
      <div className="quiz-player-container">
        <h2>Quiz Not Ready</h2>
        <p>This funnel either has no questions or fewer than the required 6 questions. Please contact the funnel creator.</p>
      </div>
    );
  }

  const currentQuestion = funnelData.questions[currentQuestionIndex];

  const quizPlayerContainerStyle = {
    '--primary-color': funnelData.primaryColor,
    '--button-color': funnelData.buttonColor,
    '--background-color': funnelData.backgroundColor,
    '--text-color': funnelData.textColor,
    backgroundColor: funnelData.backgroundColor,
    color: funnelData.textColor,
  } as React.CSSProperties;


  return (
    <div className="quiz-player-container" style={quizPlayerContainerStyle}>
      <h2 style={{color: 'var(--text-color)'}}><span role="img" aria-label="quiz">❓</span> Quiz Time!</h2>
      <div className="progress-bar-container" style={{backgroundColor: 'color-mix(in srgb, var(--button-color) 70%, transparent)'}}>
        <div className="progress-bar" style={{ width: `${((currentQuestionIndex + 1) / funnelData.questions.length) * 100}%`, backgroundColor: 'var(--primary-color)' }}></div>
      </div>
      <p className="question-counter" style={{color: 'var(--text-color)'}}>Question {currentQuestionIndex + 1} / {funnelData.questions.length}</p>

      <h3 className="quiz-question-title" style={{color: 'var(--text-color)'}}>{currentQuestion.title}</h3>

      <div className="quiz-answers-container">
        {currentQuestion.answers.map((answer, index) => (
          <button
            key={answer.id}
            className={`quiz-answer-button ${clickedAnswerIndex === index ? 'selected-answer animating' : ''}`}
            onClick={() => handleAnswerClick(index)}
            disabled={isAnimating}
            style={{
              backgroundColor: 'var(--button-color)',
              color: 'var(--text-color)',
              borderColor: 'var(--primary-color)'
            }}
          >
            {answer.text}
          </button>
        ))}
      </div>
    </div>
  );
};

interface QuizEditorComponentProps {
  questions: Question[];
  onAddQuestion: () => void;
  onEditQuestion: (index: number) => void;
  onBack: () => void;
  onImportQuestions: (importedQuestions: Question[]) => void;
}

const QuizEditorComponent: React.FC<QuizEditorComponentProps> = ({ questions, onAddQuestion, onEditQuestion, onBack, onImportQuestions }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      alert('No file selected.');
      return;
    }
    if (file.type !== 'application/json') {
      alert('Please select a JSON file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData: Question[] = JSON.parse(content);

        if (!Array.isArray(parsedData)) {
            alert('Invalid JSON format. Expected an array of questions.');
            return;
        }

        // Basic validation for the imported data structure
        const isValid = parsedData.every(q => 
            q.title && typeof q.title === 'string' && q.title.trim() !== '' && 
            Array.isArray(q.answers) && q.answers.length > 0 &&
            q.answers.every(a => a.text && typeof a.text === 'string' && a.text.trim() !== '')
        );

        if (!isValid) {
          alert('Invalid JSON format. Please ensure it is an array of questions, each with a "title" and an "answers" array, where each answer has a "text" field.');
          return;
        }

        // Assign new unique IDs to imported questions and answers to avoid key conflicts
        const questionsWithNewIds = parsedData.map(q => ({
          ...q,
          id: Date.now().toString() + Math.random().toString(), // New unique ID for question
          type: q.type || 'single-choice', // Default type if not provided
          answers: q.answers.map(a => ({
            ...a,
            id: a.id || Date.now().toString() + Math.random().toString(), // New unique ID for answer
          }))
        }));

        onImportQuestions(questionsWithNewIds);
      } catch (err) {
        console.error("Error parsing JSON file:", err);
        alert('Error reading or parsing JSON file. Please check file format.');
      }
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="quiz-editor-container">
      <h2><span role="img" aria-label="quiz">📝</span> Quiz Question List</h2>
      <div className="quiz-editor-actions">
        <button className="add-button" onClick={onAddQuestion}>
          <span role="img" aria-label="add">➕</span> Add New Question
        </button>
        <button className="import-button" onClick={triggerFileInput}>
          <span role="img" aria-label="import">📥</span> Import Questions
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          style={{ display: 'none' }}
        />
      </div>

      {questions.length === 0 ? (
        <p className="no-questions-message">No questions added yet. Click "Add New Question" or "Import Questions" to start!</p>
      ) : (
        <ul className="question-list">
          {questions.map((q, index) => (
            <li key={q.id} className="question-item" onClick={() => onEditQuestion(index)}>
              Question {index + 1}: {q.title}
            </li>
          ))}
        </ul>
      )}

      <button className="back-button" onClick={onBack}>
        <span role="img" aria-label="back">←</span> Back to Funnel Dashboard
      </button>
    </div>
  );
};

interface QuestionFormComponentProps {
  question?: Question;
  questionIndex: number | null;
  onSave: (question: Question) => void;
  onCancel: () => void;
  onDelete: () => void;
}

const QuestionFormComponent: React.FC<QuestionFormComponentProps> = ({ question, questionIndex, onSave, onCancel, onDelete }) => {
  const [title, setTitle] = useState(question ? question.title : '');
  const [answers, setAnswers] = useState<Answer[]>(
    question && question.answers.length > 0
      ? question.answers
      : Array(4).fill(null).map((_, i) => ({ id: `option-${Date.now()}-${i}`, text: `Option ${String.fromCharCode(65 + i)}` }))
  );

  useEffect(() => {
    setTitle(question ? question.title : '');
    setAnswers(
      question && question.answers.length > 0
        ? question.answers
        : Array(4).fill(null).map((_, i) => ({ id: `option-${Date.now()}-${i}`, text: `Option ${String.fromCharCode(65 + i)}` }))
    );
  }, [question]);

  const handleAnswerTextChange = (index: number, value: string) => {
    const updatedAnswers = [...answers];
    if (!updatedAnswers[index]) {
      updatedAnswers[index] = { id: `option-${Date.now()}-${index}`, text: '' };
    }
    updatedAnswers[index].text = value;
    setAnswers(updatedAnswers);
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Question title cannot be empty!');
      return;
    }
    const filteredAnswers = answers.filter(ans => ans.text.trim() !== '');
    if (filteredAnswers.length === 0) {
        alert('Please provide at least one answer option.');
        return;
    }
    // updatedQuestion.answers = filteredAnswers; // This line was causing an issue if updatedQuestion was not defined

    onSave({
      id: question?.id || Date.now().toString(),
      title,
      type: 'single-choice',
      answers: filteredAnswers, // Pass filtered answers
    });
  };

  return (
    <div className="question-form-container">
      <h2><span role="img" aria-label="edit">📝</span> Quiz Question Editor</h2>
      <p className="question-index-display">
        {questionIndex !== null ? `Editing Question ${questionIndex + 1} of 6` : 'Adding New Question'}
      </p>
      <div className="form-group">
        <label>Question Title:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., What's your biggest health concern?"
        />
      </div>
      <div className="form-group">
        <label>Question Type:</label>
        <select value="single-choice" onChange={() => { /* Not implemented yet */ }} disabled>
          <option>Single Choice</option>
          <option>Multiple Choice (Coming Soon)</option>
          <option>Text Input (Coming Soon)</option>
        </select>
      </div>
      <div className="answer-options-section">
        <p>Answer Options (Max 4):</p>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="answer-input-group">
            <input
              type="text"
              value={answers[index]?.text || ''}
              onChange={(e) => handleAnswerTextChange(index, e.target.value)}
              placeholder={`Option ${String.fromCharCode(65 + index)}`}
            />
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button className="save-button" onClick={handleSave}>
          <span role="img" aria-label="save">💾</span> Save Question
        </button>
        <button className="cancel-button" onClick={onCancel}>
          <span role="img" aria-label="cancel">←</span> Back to List
        </button>
        {questionIndex !== null && (
          <button className="delete-button" onClick={onDelete}>
            <span role="img" aria-label="delete">🗑️</span> Delete Question
          </button>
        )}
      </div>
    </div>
  );
};


interface LinkSettingsComponentProps {
    finalRedirectLink: string;
    setFinalRedirectLink: React.Dispatch<React.SetStateAction<string>>;
    tracking: string;
    setTracking: React.Dispatch<React.SetStateAction<string>>;
    conversionGoal: string;
    setConversionGoal: React.Dispatch<React.SetStateAction<string>>;
    onBack: () => void;
}

const LinkSettingsComponent: React.FC<LinkSettingsComponentProps> = ({
    finalRedirectLink, setFinalRedirectLink,
    tracking, setTracking,
    conversionGoal, setConversionGoal,
    onBack
}) => {
    return (
        <div className="link-settings-container">
            <h2><span role="img" aria-label="link">🔗</span> Final Redirect Link Settings</h2>
            <p>This is the custom link where users will be redirected after completing the quiz.</p>
            <div className="form-group">
                <label>Custom Final Redirect Link:</label>
                <input
                    type="text"
                    value={finalRedirectLink}
                    onChange={(e) => setFinalRedirectLink(e.target.value)}
                    placeholder="https://your-custom-product-page.com"
                />
            </div>
            <div className="form-group">
                <label>Optional: Tracking Parameters:</label>
                <input
                    type="text"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="utm_source=funnel&utm_campaign=..."
                />
            </div>
            <div className="form-group">
                <label>Conversion Goal:</label>
                <select value={conversionGoal} onChange={(e) => setConversionGoal(e.target.value)}>
                    <option>Product Purchase</option>
                    <option>Email Subscription</option>
                    <option>Free Trial</option>
                </select>
            </div>
            <div className="form-actions">
                <button className="save-button" onClick={() => alert('Settings applied! (Auto-saved)')}>
                    <span role="img" aria-label="save">💾</span> Applied
                </button>
                <button className="cancel-button" onClick={onBack}>
                    <span role="img" aria-label="back">←</span> Back to Editor
                </button>
            </div>
        </div>
    );
};

interface ColorCustomizerComponentProps {
    primaryColor: string;
    setPrimaryColor: React.Dispatch<React.SetStateAction<string>>;
    buttonColor: string;
    setButtonColor: React.Dispatch<React.SetStateAction<string>>;
    backgroundColor: string;
    setBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
    textColor: string;
    setTextColor: React.Dispatch<React.SetStateAction<string>>;
    onBack: () => void;
}

const ColorCustomizerComponent: React.FC<ColorCustomizerComponentProps> = ({
    primaryColor, setPrimaryColor,
    buttonColor, setButtonColor,
    backgroundColor, setBackgroundColor,
    textColor, setTextColor,
    onBack
}) => {
    return (
        <div className="color-customizer-container">
            <h2><span role="img" aria-label="palette">🎨</span> Color Customization</h2>
            <p>Customize theme colors for this funnel. (Changes are auto-saved).</p>
            <div className="form-group">
                <label>Primary Color:</label>
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </div>
            <div className="form-group">
                <label>Button Color:</label>
                <input type="color" value={buttonColor} onChange={(e) => setButtonColor(e.target.value)} />
            </div>
            <div className="form-group">
                <label>Background Color:</label>
                <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
            </div>
            <div className="form-group">
                <label>Text Color:</label>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
            </div>
            <div className="form-actions">
                <button className="save-button" onClick={() => alert('Color settings applied! (Auto-saved)')}>
                    <span role="img" aria-label="save">💾</span> Applied
                </button>
                <button className="cancel-button" onClick={onBack}>
                    <span role="img" aria-label="back">←</span> Back to Editor
                </button>
            </div>
        </div>
    );
};
