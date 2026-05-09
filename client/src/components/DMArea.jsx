// client/src/components/DMArea.jsx
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MessageInput from './MessageInput';

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

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function DMArea({ conversation, onNewMessage }) {
  const { token } = useAuth();
  const socketRef = useSocket();
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);

  const myUserId = (() => {
    try { return JSON.parse(atob(token.split('.')[1])).userId; } catch { return null; }
  })();

  useEffect(() => {
    if (!conversation) { setMessages([]); return; }

    fetch(`/api/conversations/${conversation.id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMessages);

    fetch(`/api/conversations/${conversation.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});

    const socket = socketRef?.current;
    if (!socket) return;
    socket.emit('dm:join', { conversationId: conversation.id });

    const onMsg = (msg) => {
      setMessages(prev => [...prev, msg]);
      onNewMessage?.();
    };
    socket.on('dm:new', onMsg);

    return () => {
      socket.emit('dm:leave', { conversationId: conversation.id });
      socket.off('dm:new', onMsg);
    };
  }, [conversation?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = (content) => {
    socketRef?.current?.emit('dm:send', { conversationId: conversation.id, content });
  };

  if (!conversation) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Select a conversation to start messaging
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-700)', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.2)', flexShrink: 0,
        boxShadow: '0 1px 0 rgba(0,0,0,0.2)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
        }}>
          {conversation.other_user?.username?.[0]?.toUpperCase()}
        </div>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{conversation.other_user?.username}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 8px' }}>
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showHeader = !prev || prev.user?.id !== msg.user?.id ||
            (new Date(msg.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000;
          return (
            <div key={msg.id} style={{ padding: '2px 16px', marginBottom: showHeader ? 4 : 0 }}>
              {showHeader ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 16, flexShrink: 0, marginTop: 2,
                  }}>
                    {msg.user?.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{msg.user?.username}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTime(msg.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ paddingLeft: 52, fontSize: 15, color: 'var(--text-primary)' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={sendMessage} channelName={conversation.other_user?.username || 'user'} />
    </div>
  );
}
