// client/src/components/DMList.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function DMList({ selectedId, onSelect, refreshSignal }) {
  const { token } = useAuth();
  const socketRef = useSocket();
  const [convs, setConvs] = useState([]);

  const fetchConvs = useCallback(() => {
    fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setConvs).catch(() => {});
  }, [token]);

  useEffect(() => { fetchConvs(); }, [fetchConvs, refreshSignal]);

  // Listen for new DMs to update unread counts and conversation order
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    const onDmNew = () => fetchConvs();
    socket.on('dm:new', onDmNew);
    return () => socket.off('dm:new', onDmNew);
  }, [socketRef?.current, fetchConvs]);

  return (
    <div style={{ width: 240, minWidth: 240, background: 'var(--bg-800)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.3)',
        fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', flexShrink: 0,
      }}>
        Direct Messages
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {convs.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 8px' }}>
            No conversations yet. Start one from the member list.
          </div>
        )}
        {convs.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '6px 8px', border: 'none', cursor: 'pointer', borderRadius: 4,
              background: selectedId === conv.id ? 'var(--bg-500)' : 'transparent',
              color: 'var(--text-primary)', textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (selectedId !== conv.id) e.currentTarget.style.background = 'var(--bg-600)'; }}
            onMouseLeave={e => { if (selectedId !== conv.id) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>
              {conv.other_user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.other_user?.username}
              </div>
              {conv.last_message && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.last_message}
                </div>
              )}
            </div>
            {conv.unread_count > 0 && (
              <span style={{
                background: 'var(--danger)', color: '#fff', borderRadius: 10,
                fontSize: 11, fontWeight: 700, padding: '1px 5px', flexShrink: 0,
              }}>
                {conv.unread_count > 99 ? '99+' : conv.unread_count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
