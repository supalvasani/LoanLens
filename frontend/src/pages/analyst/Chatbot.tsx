// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Analyst LoanBot Chat Interface
// Analyst can query any applicant by entering their applicant_id
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { chatbotService, type ChatMessage } from '../../services/chatbotService';

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }: Readonly<{ msg: ChatMessage }>) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--ink)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0, marginRight: 10, marginTop: 2,
        }}>
          🤖
        </div>
      )}
      <div style={{
        maxWidth: '72%',
        padding: '10px 14px',
        borderRadius: isUser ? '12px 12px 3px 12px' : '3px 12px 12px 12px',
        background: isUser ? 'var(--ink)' : 'var(--surface)',
        color: isUser ? '#fff' : 'var(--t1)',
        border: isUser ? 'none' : '1px solid var(--border)',
        fontSize: 13,
        lineHeight: 1.6,
        boxShadow: 'var(--sh)',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
        <div style={{
          fontSize: 10,
          color: isUser ? 'rgba(255,255,255,0.55)' : 'var(--t3)',
          marginTop: 6,
          textAlign: 'right',
        }}>
          {new Date(msg.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--ok-b)', color: 'var(--ok)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0, marginLeft: 10, marginTop: 2,
        }}>
          A
        </div>
      )}
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--ink)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0,
      }}>
        🤖
      </div>
      <div style={{
        padding: '10px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '3px 12px 12px 12px',
        display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--t3)',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
        <style>{`
          @keyframes bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-6px); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Suggested questions ───────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What is this applicant\'s credit score and main risk factors?',
  'Is this applicant eligible for a home loan and why?',
  'Are there any fraud signals I should be concerned about?',
  'What is the applicant\'s EMI burden and can they handle more debt?',
  'Summarise the key reasons to approve or reject this application.',
];

// ── Main component ────────────────────────────────────────────────────────────

function getInitialMessages(): ChatMessage[] {
  return [
    {
      role: 'bot',
      content: '👋 Hello! I\'m LoanBot in analyst mode.\n\nEnter an applicant ID above, then ask me anything about their credit report, score, eligibility, or fraud flags. I\'ll give you a detailed, data-driven answer.',
      ts: Date.now(),
    },
  ];
}

function createChatMessage(role: 'user' | 'bot', content: string): ChatMessage {
  return { role, content, ts: Date.now() };
}

export default function AnalystChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);
  const [applicantId, setApplicantId] = useState('');
  const [question, setQuestion]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(q?: string) {
    const text = (q ?? question).trim();
    if (!text) return;
    if (!applicantId.trim()) {
      setError('Please enter an applicant ID to query.');
      return;
    }

    setError(null);
    const userMsg = createChatMessage('user', text);
    setMessages(prev => [...prev, userMsg]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await chatbotService.send(text, applicantId.trim());
      const botMsg = createChatMessage('bot', res.answer);
      setMessages(prev => [...prev, botMsg]);
    } catch {
      const errMsg = createChatMessage('bot', '⚠️ LoanBot is temporarily unavailable. Please try again shortly.');
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <DashboardShell
      title="LoanBot — Analyst Mode"
      subtitle="Query any applicant's credit data in plain language"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 140px)' }}>

        {/* ── Applicant ID bar ────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--t3)', marginBottom: 4 }}>
                Applicant ID (raw_applicants UUID)
              </div>
              <input
                id="applicant-id-input"
                className="form-input"
                type="text"
                placeholder="e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                value={applicantId}
                onChange={e => { setApplicantId(e.target.value); setError(null); }}
                style={{ fontFamily: 'monospace', fontSize: 13 }}
              />
            </div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 20, flexShrink: 0 }}
              onClick={() => {
                setApplicantId('');
                setMessages(prev => [...prev, createChatMessage('bot', 'Applicant ID cleared. Enter a new ID to start a fresh query.')]);
              }}
            >
              Clear ID
            </button>
          </div>
          {error && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--bad)' }}>⚠ {error}</div>
          )}
        </div>

        {/* ── Chat thread ─────────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          background: 'var(--bg)',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)',
          padding: '20px 24px',
          overflowY: 'auto',
          minHeight: 0,
        }}>
          {messages.map((msg) => <Bubble key={`${msg.role}-${msg.content.slice(0, 20)}`} msg={msg} />)}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* ── Suggestions ─────────────────────────────────────────────────── */}
        {messages.length <= 2 && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, borderRadius: 99 }}
                onClick={() => send(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              id="chat-input"
              className="form-input"
              rows={2}
              placeholder="Ask anything about this applicant… (Enter to send, Shift+Enter for new line)"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKey}
              style={{ flex: 1, resize: 'none', fontFamily: 'var(--font)', fontSize: 13 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                id="send-btn"
                className="btn btn-primary"
                disabled={loading || !question.trim() || !applicantId.trim()}
                onClick={() => send()}
                style={{ minWidth: 80 }}
              >
                {loading ? <span className="spinner" /> : 'Send ↵'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setMessages([createChatMessage('bot', 'Chat cleared. Ready for a new conversation.')]);
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--t3)' }}>
            Rate limited to 10 requests/minute · All queries are logged
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
