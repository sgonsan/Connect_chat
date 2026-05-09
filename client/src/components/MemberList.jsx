// client/src/components/MemberList.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

function MemberRow({ member, myRole, myUserId, serverId, token, onRefresh, isOnline }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isMe     = member.id === myUserId;
  const canManage = myRole === 'owner' && !isMe && member.role !== 'owner';

  const changeRole = async (role) => {
    setMenuOpen(false);
    await fetch(`/api/servers/${serverId}/members/${member.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    });
    onRefresh();
  };

  const kick = async () => {
    setMenuOpen(false);
    if (!confirm(`Kick ${member.username}?`)) return;
    await fetch(`/api/servers/${serverId}/members/${member.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    onRefresh();
  };

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, cursor: canManage ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (canManage) e.currentTarget.style.background = 'var(--bg-600)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setMenuOpen(false); }}
      onClick={() => { if (canManage) setMenuOpen(v => !v); }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
          {member.username[0].toUpperCase()}
        </div>
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 10, height: 10, borderRadius: '50%',
          background: isOnline ? 'var(--success)' : 'var(--bg-500)',
          border: '2px solid var(--bg-800)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
          {member.username}{isMe ? ' (you)' : ''}
        </div>
        {member.role !== 'member' && (
          <span className={`badge badge-${member.role}`}>{member.role}</span>
        )}
      </div>
      {menuOpen && (
        <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--bg-900)', borderRadius: 6, padding: 4, zIndex: 10, minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
          onClick={e => e.stopPropagation()}>
          {member.role === 'member' && (
            <button style={ctxItemStyle} onClick={() => changeRole('moderator')}>Promote to Moderator</button>
          )}
          {member.role === 'moderator' && (
            <button style={ctxItemStyle} onClick={() => changeRole('member')}>Demote to Member</button>
          )}
          <button style={{ ...ctxItemStyle, color: 'var(--danger)' }} onClick={kick}>Kick</button>
        </div>
      )}
    </div>
  );
}

const ctxItemStyle = {
  display: 'block', width: '100%', background: 'none', border: 'none',
  color: 'var(--text-primary)', fontSize: 14, padding: '6px 8px',
  textAlign: 'left', cursor: 'pointer', borderRadius: 4,
};

export default function MemberList({ server }) {
  const { token } = useAuth();
  const socketRef = useSocket();
  const [members, setMembers] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());

  const myUserId = (() => {
    try { return JSON.parse(atob(token.split('.')[1])).userId; } catch { return null; }
  })();

  const me = members.find(m => m.id === myUserId);
  const myRole = me?.role || 'member';

  const fetchMembers = () => {
    fetch(`/api/servers/${server.id}/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMembers).catch(() => {});
  };

  useEffect(() => { fetchMembers(); }, [server?.id]);

  // Listen for presence updates from server
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket || !server) return;

    const onList    = ({ onlineUserIds }) => setOnlineIds(new Set(onlineUserIds));
    const onOnline  = ({ userId }) => setOnlineIds(prev => new Set([...prev, userId]));
    const onOffline = ({ userId }) => setOnlineIds(prev => { const s = new Set(prev); s.delete(userId); return s; });

    socket.on('presence:list',    onList);
    socket.on('presence:online',  onOnline);
    socket.on('presence:offline', onOffline);

    return () => {
      socket.off('presence:list',    onList);
      socket.off('presence:online',  onOnline);
      socket.off('presence:offline', onOffline);
    };
  }, [server?.id, socketRef?.current]);

  const byRole = { owner: [], moderator: [], member: [] };
  members.forEach(m => (byRole[m.role] || (byRole[m.role] = [])).push(m));

  const sections = [
    { key: 'owner',     label: 'Owner' },
    { key: 'moderator', label: `Moderators — ${byRole.moderator.length}` },
    { key: 'member',    label: `Members — ${byRole.member.length}` },
  ];

  return (
    <div style={{ width: 240, minWidth: 240, background: 'var(--bg-800)', display: 'flex', flexDirection: 'column', overflowY: 'auto', borderLeft: '1px solid rgba(0,0,0,0.2)' }}>
      <div style={{ padding: '16px 12px 8px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', flexShrink: 0 }}>
        Members — {members.length}
      </div>
      {sections.map(({ key, label }) => byRole[key]?.length > 0 && (
        <div key={key}>
          <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            {label}
          </div>
          <div style={{ padding: '0 4px' }}>
            {byRole[key].map(m => (
              <MemberRow key={m.id} member={m} myRole={myRole} myUserId={myUserId}
                serverId={server.id} token={token} onRefresh={fetchMembers} isOnline={onlineIds.has(m.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
