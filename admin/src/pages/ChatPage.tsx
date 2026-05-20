import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetchEnv } from '../api/client';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

interface ChatUser {
  userId: string;
  name: string;
  email: string;
  hasChat: boolean;
  messageCount: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'psychologist' | 'user_psych';
  text: string;
  createdAt: string;
}

interface PsychRequest {
  id: string;
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

type ChatTab = 'ai' | 'psychologist';

export default function ChatPage() {
  const { env, prodToken } = useEnv();
  const envOptsRef = useRef<{ baseUrl?: string; token?: string } | undefined>(undefined);
  envOptsRef.current = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatTab, setChatTab] = useState<ChatTab>('ai');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [psychRequests, setPsychRequests] = useState<PsychRequest[]>([]);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const sinceRef = useRef<string>(new Date().toISOString());

  // Derived: messages visible in each tab
  const aiMessages    = messages.filter(m => m.role === 'user'      || m.role === 'model');
  const psychMessages = messages.filter(m => m.role === 'user_psych' || m.role === 'psychologist');
  const visibleMessages = chatTab === 'ai' ? aiMessages : psychMessages;

  const fetchUsers = useCallback((q: string, p: number) => {
    setLoadingUsers(true);
    apiFetchEnv<{ users: ChatUser[]; totalPages: number; page: number }>(
      `/api/admin/coach/users?q=${encodeURIComponent(q)}&page=${p}`,
      {},
      envOptsRef.current
    )
      .then(data => { setUsers(data.users); setTotalPages(data.totalPages); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoadingUsers(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, prodToken]);

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
    apiFetchEnv<{ requests: PsychRequest[] }>('/api/admin/coach/psychologist-requests', {}, envOptsRef.current)
      .then(data => setPsychRequests(data.requests))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, prodToken]);

  async function handleDismiss(id: string) {
    setDismissing(id);
    try {
      await apiFetchEnv(`/api/admin/coach/psychologist-requests/${id}/dismiss`, { method: 'POST' }, envOptsRef.current);
      setPsychRequests(prev => prev.filter(r => r.id !== id));
    } finally {
      setDismissing(null);
    }
  }

  useEffect(() => {
    if (!selectedUserId) return;

    pollAbortRef.current?.abort();
    pollAbortRef.current = null;

    setLoadingMessages(true);
    setMessages([]);
    setHasMore(false);
    setReplyText('');
    setSendError(null);
    setIsGenerating(false);

    apiFetchEnv<{ messages: ChatMessage[]; hasMore: boolean }>(`/api/admin/coach/chats/${selectedUserId}?limit=10`, {}, envOptsRef.current)
      .then(data => {
        setMessages(data.messages);
        setHasMore(data.hasMore);
        if (data.messages.length > 0) {
          sinceRef.current = data.messages[data.messages.length - 1].createdAt;
        } else {
          sinceRef.current = new Date().toISOString();
        }
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load messages'))
      .finally(() => {
        setLoadingMessages(false);
        startPolling(selectedUserId);
      });

    function startPolling(uid: string) {
      if (pollAbortRef.current?.signal.aborted) return;
      const controller = new AbortController();
      pollAbortRef.current = controller;

      apiFetchEnv<{ messages: ChatMessage[] }>(
        `/api/admin/coach/events/${uid}?since=${encodeURIComponent(sinceRef.current)}`,
        { signal: controller.signal },
        envOptsRef.current
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
            const last = data.messages[data.messages.length - 1];
            setIsGenerating(last.role === 'user');
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) startPolling(uid);
        });
    }

    return () => {
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, env, prodToken]);

  // Clear reply text when switching tabs
  useEffect(() => {
    setReplyText('');
    setSendError(null);
  }, [chatTab]);

  async function handleLoadMore() {
    if (!selectedUserId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const before = messages[0].createdAt;
    // Snapshot scroll height before prepending so we can restore position
    const box = scrollBoxRef.current;
    const prevScrollHeight = box?.scrollHeight ?? 0;
    try {
      const data = await apiFetchEnv<{ messages: ChatMessage[]; hasMore: boolean }>(
        `/api/admin/coach/chats/${selectedUserId}?limit=10&before=${encodeURIComponent(before)}`,
        {},
        envOptsRef.current
      );
      setHasMore(data.hasMore);
      if (data.messages.length > 0) {
        setMessages(prev => [...data.messages, ...prev]);
        // Restore scroll position so viewport doesn't jump
        requestAnimationFrame(() => {
          if (box) box.scrollTop = box.scrollHeight - prevScrollHeight;
        });
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleStop() {
    if (!selectedUserId || stopping) return;
    setStopping(true);
    try {
      await apiFetchEnv(`/api/admin/coach/chats/${selectedUserId}/stop`, { method: 'POST' }, envOptsRef.current);
      setIsGenerating(false);
    } catch {
      // ignore
    } finally {
      setStopping(false);
    }
  }

  async function handleSend() {
    if (!selectedUserId || !replyText.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await apiFetchEnv<{ message: ChatMessage }>(
        `/api/admin/coach/chats/${selectedUserId}/reply`,
        { method: 'POST', body: JSON.stringify({ message: replyText.trim(), mode: chatTab }) },
        envOptsRef.current
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

  const TAB_AI_COLOR    = '#8C49D5';
  const TAB_PSYCH_COLOR = '#0EA5E9';
  const activeColor = chatTab === 'ai' ? TAB_AI_COLOR : TAB_PSYCH_COLOR;

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
                  onClick={() => { setSelectedUserId(r.userId); setChatTab('psychologist'); }}
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
        <div style={{ width: 300, borderRight: '1px solid #F3F4F6', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6' }}>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, email, or user ID…"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 13, color: '#1E2939', outline: 'none', boxSizing: 'border-box' }}
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
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '12px 16px', border: 'none', borderBottom: '1px solid #F9FAFB',
                  background: selectedUserId === u.userId ? '#F5F0FF' : 'white',
                  cursor: 'pointer', transition: 'background 0.15s',
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

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #F3F4F6' }}>
              <button onClick={() => handlePage(page - 1)} disabled={page <= 1} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: page <= 1 ? '#F9FAFB' : '#fff', color: page <= 1 ? '#D1D5DB' : '#374151', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12 }}>← Prev</button>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{page} / {totalPages}</span>
              <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: page >= totalPages ? '#F9FAFB' : '#fff', color: page >= totalPages ? '#D1D5DB' : '#374151', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 12 }}>Next →</button>
            </div>
          )}
        </div>

        {/* Chat pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedUserId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>
              Select a user to view their conversation
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: '14px 24px', borderBottom: '1px solid #F3F4F6', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2939' }}>{selectedUser?.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{selectedUser?.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {chatTab === 'ai' && isGenerating && (
                    <button
                      onClick={handleStop}
                      disabled={stopping}
                      style={{ padding: '5px 14px', borderRadius: 8, border: '1.5px solid #EF4444', background: stopping ? '#FEE2E2' : '#FFF1F1', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: stopping ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <span style={{ fontSize: 11 }}>■</span>
                      {stopping ? 'Stopping…' : 'Stop AI'}
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', background: '#fff', paddingLeft: 24 }}>
                {(['ai', 'psychologist'] as ChatTab[]).map(tab => {
                  const isActive = chatTab === tab;
                  const color = tab === 'ai' ? TAB_AI_COLOR : TAB_PSYCH_COLOR;
                  const count = tab === 'ai' ? aiMessages.length : psychMessages.length;
                  return (
                    <button
                      key={tab}
                      onClick={() => setChatTab(tab)}
                      style={{
                        padding: '10px 18px',
                        border: 'none',
                        borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
                        background: 'transparent',
                        color: isActive ? color : '#6B7280',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.15s',
                        marginBottom: -1,
                      }}
                    >
                      {tab === 'ai' ? '✦ Nora AI' : '👤 Psychologist'}
                      {count > 0 && (
                        <span style={{ fontSize: 10, background: isActive ? color : '#E5E7EB', color: isActive ? '#fff' : '#6B7280', borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Messages */}
              <div ref={scrollBoxRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#FAFAFA' }}>
                {hasMore && !loadingMessages && (
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      style={{ padding: '5px 16px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: loadingMore ? 'default' : 'pointer' }}
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
                <div ref={messagesTopRef} />
                {loadingMessages ? (
                  <div className="loading-state">Loading messages…</div>
                ) : visibleMessages.length === 0 ? (
                  <div className="empty-state">
                    {chatTab === 'ai' ? 'No AI messages yet.' : 'No psychologist messages yet.'}
                  </div>
                ) : (
                  visibleMessages.map(msg => {
                    const isUser = msg.role === 'user' || msg.role === 'user_psych';
                    const isPsych = msg.role === 'psychologist';
                    return (
                      <div
                        key={msg.id}
                        style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}
                      >
                        {!isUser && (
                          <div style={{
                            width: 28, height: 28, borderRadius: 14,
                            background: isPsych ? TAB_PSYCH_COLOR : TAB_AI_COLOR,
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                            marginRight: 8, alignSelf: 'flex-end',
                          }}>
                            {isPsych ? 'Dr' : 'N'}
                          </div>
                        )}
                        <div style={{ maxWidth: '70%' }}>
                          {!isUser && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: isPsych ? TAB_PSYCH_COLOR : TAB_AI_COLOR, marginBottom: 3, paddingLeft: 2 }}>
                              {isPsych ? 'Psychologist' : 'Nora AI'}
                            </div>
                          )}
                          <div style={{
                            background: isUser
                              ? (msg.role === 'user_psych' ? '#E0F2FE' : '#8C49D5')
                              : isPsych ? '#E0F2FE' : '#fff',
                            color: isUser ? (msg.role === 'user_psych' ? '#0369A1' : '#fff') : '#1E2939',
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
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: isUser ? 'right' : 'left', paddingLeft: !isUser ? 2 : 0, paddingRight: isUser ? 2 : 0 }}>
                            {isUser && <span style={{ marginRight: 4, fontWeight: 500, color: '#9CA3AF' }}>Parent ·</span>}
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
              <div style={{ borderTop: '1px solid #F3F4F6', background: '#fff', padding: '12px 20px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <textarea
                    ref={textareaRef}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
                    }}
                    placeholder={chatTab === 'ai'
                      ? 'Reply as Nora AI… (⌘↵ to send)'
                      : 'Reply as Psychologist… (⌘↵ to send)'}
                    rows={2}
                    style={{
                      flex: 1,
                      resize: 'none',
                      border: `1.5px solid ${chatTab === 'ai' ? '#C4B5FD' : '#7DD3FC'}`,
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
                      background: !replyText.trim() || sending ? '#E5E7EB' : activeColor,
                      color: !replyText.trim() || sending ? '#9CA3AF' : '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: !replyText.trim() || sending ? 'default' : 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.15s',
                    }}
                  >
                    {sending ? 'Sending…' : `Send as ${chatTab === 'ai' ? 'AI' : 'Psychologist'}`}
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
