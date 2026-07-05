import { useState, useRef, useEffect } from 'react';
import { chatbotService, type ChatMessage } from '../services/chatbotService';

interface ChatbotProps {
  mode: 'self' | 'analyst';
  placeholder?: string;
}

function getInitialMessages(mode: 'self' | 'analyst'): ChatMessage[] {
  return [
    {
      role: 'bot',
      content:
        mode === 'self'
          ? "Hi! I'm LoanBot. Ask me about your credit score, loan eligibility, or anything about your financial report."
          : 'LoanBot (Analyst Mode). Enter an applicant ID and ask a question about their credit report.',
      ts: Date.now(),
    },
  ];
}

function createChatMessage(role: 'user' | 'bot', content: string): ChatMessage {
  return { role, content, ts: Date.now() };
}

export function ChatbotPanel({ mode, placeholder }: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages(mode));
  const [input, setInput]           = useState('');
  const [applicantId, setApplicantId] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    setError(null);
    setInput('');
    setMessages(prev => [...prev, createChatMessage('user', q)]);
    setLoading(true);
    try {
      const res = await chatbotService.send(q, mode === 'analyst' ? applicantId || undefined : undefined);
      setMessages(prev => [...prev, createChatMessage('bot', res.answer)]);
    } catch {
      setError('LoanBot is unavailable. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };


  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
      {/* Analyst ID input */}
      {mode === 'analyst' && (
        <div style={{ padding: '12px 0 8px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Applicant ID (UUID from raw_applicants)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={applicantId}
              onChange={e => setApplicantId(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Message log */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0', marginBottom: 16 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user' ? 'var(--ink)' : 'var(--bg)',
                color: msg.role === 'user' ? '#fff' : 'var(--t1)',
                fontSize: 13,
                lineHeight: 1.55,
                border: msg.role === 'bot' ? '1px solid var(--border)' : 'none',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 16px',
              borderRadius: '12px 12px 12px 2px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--t3)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span className="spinner" style={{ width: 12, height: 12 }} />
              LoanBot is thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 10 }}>
          <span>⚠</span><span>{error}</span>
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          rows={2}
          className="form-input"
          style={{ flex: 1, resize: 'none', fontFamily: 'inherit', fontSize: 13 }}
          placeholder={placeholder ?? 'Ask LoanBot anything about your credit report…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          style={{ alignSelf: 'flex-end', padding: '10px 16px' }}
          onClick={send}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
        Press Enter to send · Shift+Enter for new line
      </div>
    </div>
  );
}
