// client/src/components/ChatArea.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MessageInput from './MessageInput';

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

export default function ChatArea({ channel }) {
  const { token } = useAuth();
  const socketRef = useSocket();
  const [messages, setMessages] = useState([]);
  const [hoverId,  setHoverId]  = useState(null);
  const bottomRef = useRef(null);

  const myUserId = (() => {
    try { return JSON.parse(atob(token.split('.')[1])).userId; } catch { return null; }
  })();

  useEffect(() => {
    if (!channel) { setMessages([]); return; }
    fetch(`/api/channels/${channel.id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMessages);
    const socket = socketRef?.current;
    if (!socket) return;
    socket.emit('channel:join', { channelId: channel.id });
    const onMsg     = (msg) => setMessages(prev => [...prev, msg]);
    const onDeleted = ({ messageId }) => setMessages(prev => prev.filter(m => m.id !== messageId));
    socket.on('message:new',     onMsg);
    socket.on('message:deleted', onDeleted);
    return () => {
      socket.emit('channel:leave', { channelId: channel.id });
      socket.off('message:new',     onMsg);
      socket.off('message:deleted', onDeleted);
    };
  }, [channel?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const deleteMessage = (id) => socketRef?.current?.emit('message:delete', { messageId: id });
  const sendMessage   = (content) => socketRef?.current?.emit('message:send', { channelId: channel.id, content });

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
                    <p style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)', wordBreak: 'break-word', paddingRight: hoverId === msg.id ? 80 : 0 }}>
                      {msg.content}
                    </p>
                    {hoverId === msg.id && (
                      <div style={{ position: 'absolute', right: 4, top: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
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

      <MessageInput onSend={sendMessage} channelName={channel.name} />
    </div>
  );
}
