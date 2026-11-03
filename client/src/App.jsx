import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { BookOpenText, BrainCircuit, MessageSquarePlus, Menu, Send, Sparkles, Trash2, UserRound, Wifi, WifiOff } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
      } catch (_err) {
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
            ? 'Add Gemini API key'
            : data.knowledgeBase === 'ready'
              ? 'Ready'
              : 'Index NIT documents'
        );
      } catch (_err) {
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
    } catch (_err) {
      setError('Could not create a new chat session.');
    }
  };

  const loadSession = async (sessionId) => {
    setCurrentSessionId(sessionId);
    try {
      const { data } = await api.get(`/sessions/${sessionId}`);
      setMessages(data.data.messages || []);
      setError('');
    } catch (_err) {
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
    } catch (_err) {
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
    } catch (_err) {
      setError('The backend is unavailable right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendQuestion(input);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex h-screen max-w-[1900px] overflow-hidden border border-slate-800/80 bg-slate-900/70 shadow-2xl shadow-slate-950/40">
        <aside className={`${sidebarOpen ? 'w-full max-w-[320px]' : 'w-0'} overflow-hidden border-r border-slate-800 bg-slate-950 transition-all duration-300 md:block`}>
          <div className="flex h-full flex-col p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-violet-500/15 p-2 text-violet-300"><BookOpenText size={18} /></div>
                <div>
                  <h1 className="text-base font-semibold">NIT Hamirpur</h1>
                  <p className="text-xs text-slate-400">Student Assistant</p>
                </div>
              </div>
              <button className="rounded-lg border border-slate-700 p-2 text-slate-300 md:hidden" onClick={() => setSidebarOpen(false)}><Menu size={16} /></button>
            </div>

            <button onClick={createSession} className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400">
              <MessageSquarePlus size={16} /> New Chat
            </button>

            <div className="flex-1 overflow-y-auto space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className={`group flex items-center justify-between rounded-xl border px-2 py-2 transition ${currentSessionId === session.id ? 'border-violet-500/60 bg-violet-500/10' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'}`}>
                  <button onClick={() => loadSession(session.id)} className="flex-1 truncate text-left text-sm text-slate-200">
                    {session.title || 'New chat'}
                  </button>
                  <button onClick={() => deleteSession(session.id)} className="ml-2 rounded p-1 text-slate-400 opacity-0 transition hover:text-red-300 group-hover:opacity-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-400">
              <div className="mb-2 flex items-center gap-2 font-medium text-slate-300"><BrainCircuit size={14} /> About</div>
              <p>Answers grounded in official NIT Hamirpur documents.</p>
            </div>
          </div>
        </aside>

        <main className="relative flex flex-1 flex-col bg-[#0f172a]">
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-slate-700 p-2 text-slate-300 md:hidden" onClick={() => setSidebarOpen(true)}><Menu size={16} /></button>
              <div>
                <h2 className="text-lg font-semibold text-white">NIT Hamirpur Assistant</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Sparkles size={12} className="text-emerald-400" />
                  Gemini and NIT sources: <span className={aiReadiness === 'Ready' ? 'text-emerald-300' : 'text-amber-200'}>{aiReadiness}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              {backendStatus === 'online' ? <Wifi size={14} className="text-emerald-400" /> : <WifiOff size={14} className="text-red-400" />}
              {backendStatus === 'online' ? 'Backend online' : 'Backend unavailable'}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="max-w-2xl text-center">
                  <h3 className="mb-4 text-4xl font-semibold tracking-tight text-white">Hello! How can I help you today?</h3>
                  <p className="mb-8 text-base text-slate-200">
                    I answer questions using official NIT Hamirpur documents. Ask about hostels, fees, or the academic calendar.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {suggestedQuestions.map((question) => (
                      <button
                        key={question}
                        onClick={() => sendQuestion(question)}
                        className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-left text-sm text-slate-200 transition hover:border-violet-500/50 hover:bg-slate-800"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-5 pb-6">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl border px-4 py-3 shadow-lg ${message.role === 'USER' ? 'border-violet-500/50 bg-violet-500/15 text-violet-50' : 'border-slate-700 bg-slate-900/90 text-slate-100'}`}>
                      <div className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] ${message.role === 'USER' ? 'text-violet-100' : 'text-slate-200'}`}>
                        {message.role === 'USER' ? <UserRound size={12} /> : <Sparkles size={12} />}
                        {message.role === 'USER' ? 'You' : 'Assistant'}
                        <span className="ml-auto">{formatTime(message.timestamp)}</span>
                      </div>

                      <div className="prose prose-invert max-w-none prose-p:my-1 prose-ul:my-2 prose-li:my-0 text-sm leading-7 text-inherit prose-headings:text-white">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>

                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 border-t border-slate-700 pt-3 text-xs text-slate-300">
                          <p className="mb-2 font-medium text-slate-200">Sources</p>
                          <ul className="space-y-1">
                            {message.sources.map((source, index) => (
                              <li key={`${source.document || 'source'}-${index}`}>
                                • {source.url ? (
                                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-500 underline-offset-2 hover:text-white">
                                    {source.document || 'NIT Hamirpur document'}
                                  </a>
                                ) : (source.document || 'NIT Hamirpur document')}
                                {source.page ? ` · page ${source.page}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                        Thinking...
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {error && (
              <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-800 bg-slate-900/80 p-4 backdrop-blur-md">
            <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-slate-700 bg-slate-950/80 p-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={1}
                placeholder="Ask about admissions, hostel, placements, academics..."
                className="max-h-36 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit(event);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="inline-flex items-center justify-center rounded-xl bg-violet-500 px-4 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-200 hover:bg-violet-400"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

export default App;
