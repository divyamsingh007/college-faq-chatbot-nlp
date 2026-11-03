import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookOpenText, Menu, MessageSquarePlus, Send, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import api from './services/api';

const suggestedQuestions = [
  'What are the hostel admission rules?',
  'When do first-year classes commence in the 2026-27 odd semester?',
  "Where can I find NIT Hamirpur's current fee structure?",
  'What information is in the academic calendar?'
];

const formatTime = (timestamp) => {
  if (!timestamp) return 'Just now';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [aiReadiness, setAiReadiness] = useState('checking');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const { data } = await api.get('/sessions');
        setSessions(data.data || []);
        if (data.data && data.data.length > 0) {
          setCurrentSessionId(data.data[0].id);
          setMessages(data.data[0].messages || []);
        }
      } catch {
        setError('Unable to load previous sessions.');
      }
    };

    loadSessions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { data } = await api.get('/health');
        setBackendStatus(data.status === 'ok' ? 'online' : 'offline');
        setAiReadiness(
          data.gemini !== 'configured'
            ? 'Gemini key not configured'
            : data.knowledgeBase === 'ready'
              ? 'Ready'
              : 'NIT documents not indexed'
        );
      } catch {
        setBackendStatus('offline');
        setAiReadiness('Unavailable');
      }
    };

    checkHealth();
  }, []);

  const createSession = async () => {
    try {
      const { data } = await api.post('/sessions');
      const nextSession = data.data;
      setSessions((prev) => [nextSession, ...prev]);
      setCurrentSessionId(nextSession.id);
      setMessages([]);
      setError('');
      setSidebarOpen(false);
    } catch {
      setError('Could not create a new chat session.');
    }
  };

  const loadSession = async (sessionId) => {
    setCurrentSessionId(sessionId);
    try {
      const { data } = await api.get(`/sessions/${sessionId}`);
      setMessages(data.data.messages || []);
      setError('');
      setSidebarOpen(false);
    } catch {
      setError('Could not open the selected conversation.');
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      await api.delete(`/sessions/${sessionId}`);
      const updatedSessions = sessions.filter((session) => session.id !== sessionId);
      setSessions(updatedSessions);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(updatedSessions[0]?.id || null);
        setMessages(updatedSessions[0]?.messages || []);
      }
    } catch {
      setError('Unable to delete conversation.');
    }
  };

  const sendQuestion = async (questionText) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    setInput('');
    setError('');
    setLoading(true);

    let sessionId = currentSessionId;
    if (!sessionId) {
      const created = await api.post('/sessions');
      sessionId = created.data.data.id;
      setCurrentSessionId(sessionId);
      setSessions((prev) => [created.data.data, ...prev]);
    }

    const optimisticUser = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: trimmed,
      timestamp: new Date().toISOString()
    };

    const optimisticMessages = [...messages, optimisticUser];
    setMessages(optimisticMessages);

    try {
      const { data } = await api.post('/chat', {
        sessionId,
        message: trimmed
      });

      const assistantReply = {
        id: data.data.messageId || `assistant-${Date.now()}`,
        role: 'ASSISTANT',
        content: data.data.answer,
        sources: data.data.sources || [],
        timestamp: data.data.timestamp || new Date().toISOString()
      };

      const nextMessages = [...optimisticMessages, assistantReply];
      setMessages(nextMessages);
      const refreshed = await api.get(`/sessions/${sessionId}`);
      const sessionList = refreshed.data.data;
      setSessions((prev) => {
        const withoutCurrent = prev.filter((session) => session.id !== sessionId);
        return [sessionList, ...withoutCurrent];
      });
    } catch {
      setError('The service is unavailable right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendQuestion(input);
  };

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close conversation sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`} aria-label="Conversations">
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-mark"><BookOpenText size={19} strokeWidth={1.7} /></span>
            <span className="brand-copy">
              <span className="brand-name">NIT Hamirpur</span>
              <span className="brand-caption">Student information</span>
            </span>
          </div>
          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Close conversations"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <button type="button" className="new-chat-button" onClick={createSession}>
          <MessageSquarePlus size={17} strokeWidth={1.8} />
          <span>New conversation</span>
        </button>

        <div className="conversation-heading">Recent conversations</div>
        <div className="conversation-list">
          {sessions.length === 0 ? (
            <p className="conversation-empty">Your conversations will appear here.</p>
          ) : sessions.map((session) => (
            <div
              key={session.id}
              className={`conversation-row ${currentSessionId === session.id ? 'conversation-row--active' : ''}`}
            >
              <button
                type="button"
                className="conversation-select"
                onClick={() => loadSession(session.id)}
                aria-current={currentSessionId === session.id ? 'page' : undefined}
              >
                <span className="conversation-title">{session.title || 'New conversation'}</span>
              </button>
              <button
                type="button"
                className="icon-button conversation-delete"
                onClick={() => deleteSession(session.id)}
                aria-label={`Delete ${session.title || 'conversation'}`}
                title="Delete conversation"
              >
                <Trash2 size={15} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <span className="footer-status-dot" />
          <span>Answers from official institute documents</span>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button menu-button"
              aria-label={sidebarOpen ? 'Close conversations' : 'Open conversations'}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <Menu size={19} strokeWidth={1.8} />
            </button>
            <div className="page-title">
              <h1>NIT Hamirpur</h1>
              <span>Student assistant</span>
            </div>
          </div>

          <div className={`service-status service-status--${backendStatus}`} role="status">
            {backendStatus === 'online' ? <Wifi size={15} /> : <WifiOff size={15} />}
            <span>{backendStatus === 'online' ? 'Connected' : backendStatus === 'checking' ? 'Connecting' : 'Unavailable'}</span>
            <span className="status-divider" aria-hidden="true" />
            <span className="readiness-label">{aiReadiness}</span>
          </div>
        </header>

        <section className={`conversation-panel ${messages.length === 0 ? 'conversation-panel--empty' : ''}`}>
          {messages.length === 0 ? (
            <div className="welcome">
              <h2>How can we help?</h2>
              <p>Find information from official NIT Hamirpur documents.</p>
              <div className="suggestions" aria-label="Suggested questions">
                {suggestedQuestions.map((question) => (
                  <button
                    type="button"
                    key={question}
                    className="suggestion"
                    onClick={() => sendQuestion(question)}
                  >
                    <span>{question}</span>
                    <span className="suggestion-arrow" aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list" aria-live="polite">
              {messages.map((message) => (
                <article key={message.id} className={`message message--${message.role === 'USER' ? 'user' : 'assistant'}`}>
                  <div className="message-meta">
                    <span>{message.role === 'USER' ? 'You' : 'NIT Hamirpur'}</span>
                    <time>{formatTime(message.timestamp)}</time>
                  </div>
                  <div className="message-content">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>

                  {message.sources && message.sources.length > 0 && (
                    <div className="source-list">
                      <span className="source-heading">Sources</span>
                      {message.sources.map((source, index) => (
                        source.url ? (
                          <a
                            key={`${source.document || 'source'}-${index}`}
                            className="source-link"
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span>{source.document || 'NIT Hamirpur document'}</span>
                            {source.page ? <span>p. {source.page}</span> : null}
                          </a>
                        ) : (
                          <span key={`${source.document || 'source'}-${index}`} className="source-link">
                            <span>{source.document || 'NIT Hamirpur document'}</span>
                            {source.page ? <span>p. {source.page}</span> : null}
                          </span>
                        )
                      ))}
                    </div>
                  )}
                </article>
              ))}

              {loading && (
                <div className="message message--assistant" role="status" aria-label="Preparing an answer">
                  <div className="message-meta"><span>NIT Hamirpur</span></div>
                  <div className="loading-indicator"><span /> Looking through institute documents</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {error && <div className="error-message" role="alert">{error}</div>}
        </section>

        <footer className="composer-area">
          <form onSubmit={handleSubmit} className="composer">
            <label className="visually-hidden" htmlFor="question-input">Your question</label>
            <textarea
              id="question-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={1}
              placeholder="Ask a question about NIT Hamirpur"
              className="question-input"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSubmit(event);
                }
              }}
            />
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim() || loading}
              aria-label="Send question"
              title="Send question"
            >
              <Send size={17} strokeWidth={1.9} />
            </button>
          </form>
          <p className="composer-note">Answers are based on the documents shown in their citations.</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
