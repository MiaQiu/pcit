import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api/client';

interface ChatUser {
  userId: string;
  name: string;
  email: string;
  messageCount: number;
  lastMessageAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'psychologist';
  text: string;
  createdAt: string;
}

type ReplyMode = 'ai' | 'psychologist';

interface PsychRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function ChatPage() {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyMode, setReplyMode] = useState<ReplyMode>('ai');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [psychRequests, setPsychRequests] = useState<PsychRequest[]>([]);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    apiFetch<{ requests: PsychRequest[] }>('/api/admin/coach/psychologist-requests')
      .then(data => setPsychRequests(data.requests))
      .catch(() => {});
  }, []);

  async function handleDismiss(id: string) {
    setDismissing(id);
    try {
      await apiFetch(`/api/admin/coach/psychologist-requests/${id}/dismiss`, { method: 'POST' });
      setPsychRequests(prev => prev.filter(r => r.id !== id));
    } finally {
      setDismissing(null);
    }
  }

  useEffect(() => {
    apiFetch<{ chats: ChatUser[] }>('/api/admin/coach/chats')
      .then(data => setUsers(data.chats))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    setLoadingMessages(true);
    setReplyText('');
    setSendError(null);
    apiFetch<{ messages: ChatMessage[] }>(`/api/admin/coach/chats/${selectedUserId}`)
      .then(data => {
        setMessages(data.messages);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load messages'))
      .finally(() => setLoadingMessages(false));
  }, [selectedUserId]);

  async function handleSend() {
    if (!selectedUserId || !replyText.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const data = await apiFetch<{ message: ChatMessage }>(
        `/api/admin/coach/chats/${selectedUserId}/reply`,
        { method: 'POST', body: JSON.stringify({ message: replyText.trim(), mode: replyMode }) }
      );
      setMessages(prev => [...prev, data.message]);
      setReplyText('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  const selectedUser = users.find(u => u.userId === selectedUserId);

  function fmt(dateStr: string) {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function fmtShort(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
    });
  }

  return (
    <div className="page" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #F3F4F6' }}>
        <h1 style={{ margin: 0 }}>Coach Chat</h1>
        <p className="page-subtitle" style={{ marginTop: 4 }}>
          {users.length} users with conversations
        </p>
      </div>

      {psychRequests.length > 0 && (
        <div style={{ margin: '0 28px 16px', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #FCD34D', background: '#FFFBEB' }}>
          <div style={{ padding: '10px 16px', background: '#FEF3C7', borderBottom: '1px solid #FCD34D', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#92400E' }}>
              {psychRequests.length} pending psychologist request{psychRequests.length > 1 ? 's' : ''}
            </span>
          </div>
          {psychRequests.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #FEF3C7' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1E2939' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{r.email} · {new Date(r.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSelectedUserId(r.userId)}
                  style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #0EA5E9', background: '#E0F2FE', color: '#0369A1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  View Chat
                </button>
                <button
                  onClick={() => handleDismiss(r.id)}
                  disabled={dismissing === r.id}
                  style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {dismissing === r.id ? '…' : 'Dismiss'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-state" style={{ margin: 16 }}>{error}</div>}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* User list */}
        <div style={{
          width: 300,
          borderRight: '1px solid #F3F4F6',
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          {loadingUsers ? (
            <div className="loading-state">Loading…</div>
          ) : users.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>No chats yet.</div>
          ) : (
            users.map(u => (
              <button
                key={u.userId}
                onClick={() => setSelectedUserId(u.userId)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 20px',
                  border: 'none',
                  borderBottom: '1px solid #F9FAFB',
                  background: selectedUserId === u.userId ? '#F5F0FF' : 'white',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1E2939', marginBottom: 2 }}>
                  {u.name}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{u.email}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF' }}>
                  <span>{u.messageCount} messages</span>
                  <span>{fmtShort(u.lastMessageAt)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Chat pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedUserId ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#9CA3AF', fontSize: 14,
            }}>
              Select a user to view their conversation
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{
                padding: '14px 24px',
                borderBottom: '1px solid #F3F4F6',
                background: '#fff',
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2939' }}>
                  {selectedUser?.name}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{selectedUser?.email}</div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#FAFAFA' }}>
                {loadingMessages ? (
                  <div className="loading-state">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">No messages.</div>
                ) : (
                  messages.map(msg => {
                    const isUser = msg.role === 'user';
                    const isPsych = msg.role === 'psychologist';
                    const isModel = msg.role === 'model';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: 'flex',
                          justifyContent: isUser ? 'flex-end' : 'flex-start',
                          marginBottom: 12,
                        }}
                      >
                        {(isModel || isPsych) && (
                          <div style={{
                            width: 28, height: 28, borderRadius: 14,
                            background: isPsych ? '#0EA5E9' : '#8C49D5', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                            marginRight: 8, alignSelf: 'flex-end',
                          }}>{isPsych ? 'Dr' : 'N'}</div>
                        )}
                        <div style={{ maxWidth: '70%' }}>
                          {isPsych && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#0EA5E9', marginBottom: 3, paddingLeft: 2 }}>
                              Psychologist
                            </div>
                          )}
                          <div style={{
                            background: isUser ? '#8C49D5' : isPsych ? '#E0F2FE' : '#fff',
                            color: isUser ? '#fff' : '#1E2939',
                            borderRadius: 16,
                            borderBottomRightRadius: isUser ? 4 : 16,
                            borderBottomLeftRadius: !isUser ? 4 : 16,
                            padding: '10px 14px',
                            fontSize: 14,
                            lineHeight: 1.5,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            whiteSpace: 'pre-wrap',
                          }}>
                            {msg.text}
                          </div>
                          <div style={{
                            fontSize: 11, color: '#9CA3AF', marginTop: 4,
                            textAlign: isUser ? 'right' : 'left',
                            paddingLeft: !isUser ? 2 : 0,
                            paddingRight: isUser ? 2 : 0,
                          }}>
                            {fmt(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply composer */}
              <div style={{
                borderTop: '1px solid #F3F4F6',
                background: '#fff',
                padding: '12px 20px',
              }}>
                {/* Mode toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {(['ai', 'psychologist'] as ReplyMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setReplyMode(mode)}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 20,
                        border: '1.5px solid',
                        borderColor: replyMode === mode
                          ? (mode === 'ai' ? '#8C49D5' : '#0EA5E9')
                          : '#E5E7EB',
                        background: replyMode === mode
                          ? (mode === 'ai' ? '#F5F0FF' : '#E0F2FE')
                          : '#fff',
                        color: replyMode === mode
                          ? (mode === 'ai' ? '#8C49D5' : '#0EA5E9')
                          : '#6B7280',
                        fontSize: 13,
                        fontWeight: replyMode === mode ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {mode === 'ai' ? '✦ Reply as AI' : '👤 Reply as Psychologist'}
                    </button>
                  ))}
                </div>

                {/* Text input + send */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <textarea
                    ref={textareaRef}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
                    }}
                    placeholder={replyMode === 'ai'
                      ? 'Type an AI reply… (⌘↵ to send)'
                      : 'Type a psychologist reply… (⌘↵ to send)'}
                    rows={2}
                    style={{
                      flex: 1,
                      resize: 'none',
                      border: '1.5px solid',
                      borderColor: replyMode === 'ai' ? '#C4B5FD' : '#7DD3FC',
                      borderRadius: 10,
                      padding: '9px 12px',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      color: '#1E2939',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!replyText.trim() || sending}
                    style={{
                      padding: '9px 20px',
                      borderRadius: 10,
                      border: 'none',
                      background: !replyText.trim() || sending
                        ? '#E5E7EB'
                        : replyMode === 'ai' ? '#8C49D5' : '#0EA5E9',
                      color: !replyText.trim() || sending ? '#9CA3AF' : '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: !replyText.trim() || sending ? 'default' : 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.15s',
                    }}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
                {sendError && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#EF4444' }}>{sendError}</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
