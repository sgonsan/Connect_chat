// client/src/components/ChatArea.jsx
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MessageInput from './MessageInput';
import EmojiPicker from './EmojiPicker';

const mdComponents = {
  p:    ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    return isBlock
      ? <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 6, margin: '4px 0', overflow: 'auto' }}><code style={{ fontFamily: 'monospace', fontSize: 13 }}>{children}</code></pre>
      : <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: 3, fontFamily: 'monospace', fontSize: 13 }}>{children}</code>;
  },
  a:    ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{children}</a>,
};

function groupMessages(messages) {
  const FIVE_MIN = 5 * 60 * 1000;
  const groups = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const sameAuthor = last && last.userId === msg.user?.id;
    const lastTs = last?.messages[last.messages.length - 1]?.created_at;
    const within5 = lastTs && (new Date(msg.created_at) - new Date(lastTs)) < FIVE_MIN;
    if (sameAuthor && within5) {
      last.messages.push(msg);
    } else {
      groups.push({ userId: msg.user?.id, author: msg.user, messages: [msg] });
    }
  }
  return groups;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function groupReactions(reactions = []) {
  const map = {};
  for (const r of reactions) {
    const key = r.emoji;
    if (!map[key]) map[key] = { emoji: key, userIds: [] };
    map[key].userIds.push(r.userId || r.user_id);
  }
  return Object.values(map);
}

export default function ChatArea({ channel }) {
  const { token } = useAuth();
  const socketRef = useSocket();
  const [messages,    setMessages]    = useState([]);
  const [hoverId,     setHoverId]     = useState(null);
  const [editingId,   setEditingId]   = useState(null);
  const [editContent, setEditContent] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [pickerMsgId, setPickerMsgId] = useState(null);
  const bottomRef  = useRef(null);
  const typingTimers = useRef({});

  const myUserId = (() => {
    try { return JSON.parse(atob(token.split('.')[1])).userId; } catch { return null; }
  })();

  useEffect(() => {
    if (!channel) { setMessages([]); setTypingUsers({}); return; }

    fetch(`/api/channels/${channel.id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMessages);

    // Mark as read
    fetch(`/api/channels/${channel.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});

    const socket = socketRef?.current;
    if (!socket) return;
    socket.emit('channel:join', { channelId: channel.id });

    const onMsg     = (msg) => setMessages(prev => [...prev, msg]);
    const onDeleted = ({ messageId }) => setMessages(prev => prev.filter(m => m.id !== messageId));
    const onEdited  = ({ id, content, editedAt }) =>
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content, edited_at: editedAt } : m));
    const onTyping  = ({ channelId: ch, userId, isTyping }) => {
      if (ch !== channel?.id || userId === myUserId) return;
      setTypingUsers(prev => {
        const next = { ...prev };
        clearTimeout(typingTimers.current[userId]);
        if (isTyping) {
          next[userId] = true;
          typingTimers.current[userId] = setTimeout(() => {
            setTypingUsers(p => { const n = { ...p }; delete n[userId]; return n; });
          }, 5000);
        } else {
          delete next[userId];
        }
        return next;
      });
    };

    const onReacted = ({ messageId, reactions }) =>
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));

    socket.on('message:new',     onMsg);
    socket.on('message:deleted', onDeleted);
    socket.on('message:edited',  onEdited);
    socket.on('typing:update',   onTyping);
    socket.on('message:reacted', onReacted);

    return () => {
      socket.emit('channel:leave', { channelId: channel.id });
      socket.off('message:new',     onMsg);
      socket.off('message:deleted', onDeleted);
      socket.off('message:edited',  onEdited);
      socket.off('typing:update',   onTyping);
      socket.off('message:reacted', onReacted);
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
  }, [channel?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const deleteMessage = (id) => socketRef?.current?.emit('message:delete', { messageId: id });
  const sendMessage   = (content) => socketRef?.current?.emit('message:send', { channelId: channel.id, content });

  const startEdit = (msg) => { setEditingId(msg.id); setEditContent(msg.content); };
  const submitEdit = (msgId) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    socketRef?.current?.emit('message:edit', { messageId: msgId, content: trimmed });
    setEditingId(null);
  };

  const typingCount = Object.keys(typingUsers).length;

  if (!channel) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Select a channel to start chatting
    </div>
  );

  const groups = groupMessages(messages);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-700)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.2)', flexShrink: 0,
        boxShadow: '0 1px 0 rgba(0,0,0,0.2)',
      }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: 20 }}>#</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{channel.name}</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 8px' }}>
        {groups.map((group, gi) => (
          <div key={gi} style={{ padding: '2px 16px', marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 16, marginTop: 2,
              }}>
                {(group.author?.username || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{group.author?.username}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatTime(group.messages[0].created_at)}
                  </span>
                </div>
                {group.messages.map(msg => (
                  <div
                    key={msg.id}
                    onMouseEnter={() => setHoverId(msg.id)}
                    onMouseLeave={() => setHoverId(null)}
                    style={{
                      position: 'relative', padding: '2px 0', borderRadius: 4,
                      background: hoverId === msg.id ? 'rgba(0,0,0,0.08)' : 'transparent',
                    }}
                  >
                    {editingId === msg.id ? (
                      <div>
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: 'var(--bg-500)', border: '1px solid var(--accent)',
                            borderRadius: 4, color: 'var(--text-primary)', padding: '4px 8px',
                            fontSize: 15, fontFamily: 'inherit', resize: 'none',
                          }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter to save · Escape to cancel</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 15, color: 'var(--text-primary)', wordBreak: 'break-word', paddingRight: hoverId === msg.id ? 88 : 0 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                          {msg.content}
                        </ReactMarkdown>
                        {msg.edited_at && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>(edited)</span>
                        )}
                      </div>
                    )}

                    {/* Reactions display */}
                    {groupReactions(msg.reactions).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {groupReactions(msg.reactions).map(r => (
                          <button
                            key={r.emoji}
                            onClick={() => socketRef?.current?.emit('message:react', { messageId: msg.id, emoji: r.emoji })}
                            style={{
                              background: r.userIds.includes(myUserId) ? 'rgba(88,101,242,0.3)' : 'var(--bg-600)',
                              border: `1px solid ${r.userIds.includes(myUserId) ? 'var(--accent)' : 'transparent'}`,
                              borderRadius: 12, padding: '2px 8px', cursor: 'pointer', fontSize: 13,
                              color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {r.emoji} <span style={{ fontSize: 12 }}>{r.userIds.length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Emoji picker */}
                    {pickerMsgId === msg.id && (
                      <div style={{ position: 'relative' }}>
                        <EmojiPicker
                          onPick={(emoji) => socketRef?.current?.emit('message:react', { messageId: msg.id, emoji })}
                          onClose={() => setPickerMsgId(null)}
                        />
                      </div>
                    )}

                    {hoverId === msg.id && editingId !== msg.id && (
                      <div style={{ position: 'absolute', right: 4, top: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => setPickerMsgId(pickerMsgId === msg.id ? null : msg.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px' }}
                          title="React"
                        >😊</button>
                        {msg.user?.id === myUserId && (
                          <button
                            onClick={() => startEdit(msg)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px' }}
                            title="Edit"
                          >✏️</button>
                        )}
                        {msg.user?.id === myUserId && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, padding: '0 4px' }}
                            title="Delete"
                          >✕</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingCount > 0 && (
        <div style={{ padding: '0 16px 4px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', flexShrink: 0 }}>
          {typingCount === 1 ? 'Someone is typing…' : `${typingCount} people are typing…`}
        </div>
      )}

      <MessageInput
        onSend={sendMessage}
        channelName={channel.name}
        onTypingStart={() => socketRef?.current?.emit('typing:start', { channelId: channel.id })}
        onTypingStop={()  => socketRef?.current?.emit('typing:stop',  { channelId: channel.id })}
      />
    </div>
  );
}
