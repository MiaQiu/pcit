import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../api/client';

interface ChatUser {
  userId: string;
  name: string;
  email: string;
  hasChat: boolean;
  messageCount: number;
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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyMode, setReplyMode] = useState<ReplyMode>('ai');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [psychRequests, setPsychRequests] = useState<PsychRequest[]>([]);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const sinceRef = useRef<string>(new Date().toISOString());

  const fetchUsers = useCallback((q: string, p: number) => {
    setLoadingUsers(true);
    apiFetch<{ users: ChatUser[]; totalPages: number; page: number }>(
      `/api/admin/coach/users?q=${encodeURIComponent(q)}&page=${p}`
    )
      .then(data => { setUsers(data.users); setTotalPages(data.totalPages); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => { fetchUsers('', 1); }, [fetchUsers]);

  function handleSearch(q: string) {
    setSearch(q);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchUsers(q, 1), 300);
  }

  function handlePage(p: number) {
    setPage(p);
    fetchUsers(search, p);
  }

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
    if (!selectedUserId) return;

    // Cancel any running poll for the previous user
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;

    setLoadingMessages(true);
    setMessages([]);
    setReplyText('');
    setSendError(null);
    setIsGenerating(false);

    // 1. Load full history
    apiFetch<{ messages: ChatMessage[] }>(`/api/admin/coach/chats/${selectedUserId}`)
      .then(data => {
        setMessages(data.messages);
        if (data.messages.length > 0) {
          sinceRef.current = data.messages[data.messages.length - 1].createdAt;
        } else {
          sinceRef.current = new Date().toISOString();
        }
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load messages'))
      .finally(() => {
        setLoadingMessages(false);
        startPolling(selectedUserId);
      });

    // 2. Long-poll loop — reconnects immediately after each response
    function startPolling(uid: string) {
      if (pollAbortRef.current?.signal.aborted) return;
      const controller = new AbortController();
      pollAbortRef.current = controller;

      apiFetch<{ messages: ChatMessage[] }>(
        `/api/admin/coach/events/${uid}?since=${encodeURIComponent(sinceRef.current)}`,
        { signal: controller.signal }
      )
        .then(data => {
          if (controller.signal.aborted) return;
          if (data.messages.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newOnes = data.messages.filter(m => !existingIds.has(m.id));
              if (newOnes.length === 0) return prev;
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
              return [...prev, ...newOnes];
            });
            sinceRef.current = data.messages[data.messages.length - 1].createdAt;
            // User message arrived → LLM is now generating; model/psych arrived → done
            const last = data.messages[data.messages.length - 1];
            setIsGenerating(last.role === 'user');
          }
        })
        .catch(() => {}) // aborted or network error — reconnect below
        .finally(() => {
          if (!controller.signal.aborted) startPolling(uid);
        });
    }

    return () => {
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
    };
  }, [selectedUserId]);

  async function handleSend() {
    if (!selectedUserId || !replyText.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await apiFetch<{ message: ChatMessage }>(
        `/api/admin/coach/chats/${selectedUserId}/reply`,
        { method: 'POST', body: JSON.stringify({ message: replyText.trim(), mode: replyMode }) }
      );
      setReplyText('');
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

  return (
    <div className="page" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #F3F4F6' }}>
        <h1 style={{ margin: 0 }}>Coach Chat</h1>
        <p className="page-subtitle" style={{ marginTop: 4 }}>Search users to view or start a conversation</p>
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
          {/* Search box */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6' }}>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, email, or user ID…"
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: 8,
                border: '1.5px solid #E5E7EB',
                fontSize: 13,
                color: '#1E2939',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {loadingUsers ? (
            <div className="loading-state">Loading…</div>
          ) : users.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>No users found.</div>
          ) : (
            users.map(u => (
              <button
                key={u.userId}
                onClick={() => setSelectedUserId(u.userId)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: '1px solid #F9FAFB',
                  background: selectedUserId === u.userId ? '#F5F0FF' : 'white',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1E2939' }}>{u.name}</span>
                  {u.hasChat && (
                    <span style={{ fontSize: 10, background: '#EDE9FE', color: '#7C3AED', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                      {u.messageCount} msgs
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{u.email}</div>
              </button>
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #F3F4F6' }}>
              <button
                onClick={() => handlePage(page - 1)}
                disabled={page <= 1}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: page <= 1 ? '#F9FAFB' : '#fff', color: page <= 1 ? '#D1D5DB' : '#374151', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12 }}
              >← Prev</button>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{page} / {totalPages}</span>
              <button
                onClick={() => handlePage(page + 1)}
                disabled={page >= totalPages}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: page >= totalPages ? '#F9FAFB' : '#fff', color: page >= totalPages ? '#D1D5DB' : '#374151', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 12 }}
              >Next →</button>
            </div>
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2939' }}>{selectedUser?.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{selectedUser?.email}</div>
                </div>
                {selectedUser && !selectedUser.hasChat && (
                  <span style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>No chat history — send the first message</span>
                )}
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
