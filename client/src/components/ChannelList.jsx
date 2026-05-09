// client/src/components/ChannelList.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import InviteModal from './InviteModal';

function ChannelItem({ channel, active, onClick, unreadCount }) {
  const [hover, setHover] = useState(false);
  const isVoice = channel.type === 'voice';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%', padding: '6px 8px', border: 'none', cursor: 'pointer',
        borderRadius: 4, textAlign: 'left', fontSize: 15,
        background: active ? 'var(--bg-500)' : hover ? 'var(--bg-600)' : 'transparent',
        color: active || hover || unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'background 0.1s, color 0.1s',
        fontWeight: unreadCount > 0 && !active ? 600 : 400,
      }}
    >
      <span style={{ opacity: 0.7, fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>
        {isVoice ? '🔊' : '#'}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {channel.name}
      </span>
      {unreadCount > 0 && !active && (
        <span style={{
          background: 'var(--danger)', color: '#fff', borderRadius: 10,
          fontSize: 11, fontWeight: 700, padding: '1px 5px', minWidth: 18,
          textAlign: 'center', flexShrink: 0,
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

function SectionHeader({ label, canAdd, onAdd }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 8px 4px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
        {label}
      </span>
      {canAdd && (
        <button
          onClick={onAdd}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1,
            padding: '0 2px', color: hover ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
          title="Create channel"
        >+</button>
      )}
    </div>
  );
}

function groupByCategory(channels) {
  const groups = {};
  for (const ch of channels) {
    const key = ch.category || '';
    if (!groups[key]) groups[key] = { label: ch.category || null, channels: [] };
    groups[key].channels.push(ch);
  }
  // Sort: null/empty category first, then alphabetical
  return Object.values(groups).sort((a, b) => {
    if (!a.label && !b.label) return 0;
    if (!a.label) return -1;
    if (!b.label) return 1;
    return a.label.localeCompare(b.label);
  });
}

const menuItemStyle = {
  display: 'block', width: '100%', background: 'none', border: 'none',
  color: 'var(--text-primary)', fontSize: 14, padding: '6px 8px',
  textAlign: 'left', cursor: 'pointer', borderRadius: 4,
};

export default function ChannelList({ server, onSelect, onSelectVoiceChannel, selectedId, onToggleMembers, onChannelDeleted }) {
  const { token } = useAuth();
  const socketRef = useSocket();
  const [channels,      setChannels]      = useState([]);
  const [myRole,        setMyRole]        = useState('member');
  const [showCreate,    setShowCreate]    = useState(false);
  const [showInvite,    setShowInvite]    = useState(false);
  const [headerMenu,    setHeaderMenu]    = useState(false);
  const [newName,       setNewName]       = useState('');
  const [newType,       setNewType]       = useState('text');
  const [newCategory,   setNewCategory]   = useState('');
  const [unread,        setUnread]        = useState({});
  const [collapsedCats, setCollapsedCats] = useState(new Set());

  const toggleCat = (key) => setCollapsedCats(prev => {
    const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s;
  });

  const fetchData = () => {
    if (!server) { setChannels([]); setMyRole('member'); return; }
    fetch(`/api/servers/${server.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setChannels(data.channels || []));
    fetch(`/api/servers/${server.id}/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(members => {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const me = members.find(m => m.id === payload.userId);
          setMyRole(me?.role || 'member');
        } catch { setMyRole('member'); }
      }).catch(() => {});
  };

  useEffect(() => { fetchData(); }, [server?.id]);

  // Join server socket room and listen for real-time channel changes
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket || !server) return;

    socket.emit('server:join', { serverId: server.id });
    socket.emit('server:presence_hello', { serverId: server.id });

    const onCreated = (channel) => setChannels(prev => [...prev, channel]);
    const onDeleted = ({ channelId }) => {
      setChannels(prev => prev.filter(c => c.id !== channelId));
      onChannelDeleted?.(channelId);
    };

    socket.on('server:channel_created', onCreated);
    socket.on('server:channel_deleted', onDeleted);

    return () => {
      socket.emit('server:leave', { serverId: server.id });
      socket.off('server:channel_created', onCreated);
      socket.off('server:channel_deleted', onDeleted);
    };
  }, [server?.id, socketRef?.current]);

  // Fetch unread counts when server changes
  useEffect(() => {
    if (!server) { setUnread({}); return; }
    fetch(`/api/servers/${server.id}/unread`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setUnread).catch(() => {});
  }, [server?.id]);

  // Increment unread count when a new message arrives in a channel the user is not viewing
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    const onMsg = (msg) => {
      if (msg.channel_id && msg.channel_id !== selectedId) {
        setUnread(prev => ({ ...prev, [msg.channel_id]: (prev[msg.channel_id] || 0) + 1 }));
      }
    };
    socket.on('message:new', onMsg);
    return () => socket.off('message:new', onMsg);
  }, [selectedId]);

  const canManage = ['owner', 'moderator'].includes(myRole);

  const createChannel = async (e) => {
    e.preventDefault();
    await fetch(`/api/servers/${server.id}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.toLowerCase().replace(/\s+/g, '-'), type: newType, category: newCategory || null }),
    });
    setNewName(''); setNewType('text'); setNewCategory(''); setShowCreate(false);
  };

  const leaveServer = async () => {
    if (!confirm(`Leave "${server.name}"?`)) return;
    await fetch(`/api/servers/${server.id}/leave`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    window.location.reload();
  };

  if (!server) return (
    <div style={{ width: 240, minWidth: 240, background: 'var(--bg-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
      Select a server
    </div>
  );

  return (
    <div style={{ width: 240, minWidth: 240, background: 'var(--bg-800)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Server header */}
      <button
        onClick={() => setHeaderMenu(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'none', border: 'none',
          borderBottom: '1px solid rgba(0,0,0,0.3)', cursor: 'pointer',
          color: 'var(--text-primary)', fontWeight: 700, fontSize: 15,
          transition: 'background 0.1s', flexShrink: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-600)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</span>
        <span style={{ fontSize: 12, opacity: 0.6, marginLeft: 8, flexShrink: 0 }}>{headerMenu ? '▲' : '▼'}</span>
      </button>

      {/* Header dropdown menu */}
      {headerMenu && (
        <div style={{ background: 'var(--bg-900)', padding: 4, flexShrink: 0 }}
          onMouseLeave={() => setHeaderMenu(false)}>
          {canManage && (
            <button style={menuItemStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              onClick={() => { setShowInvite(true); setHeaderMenu(false); }}>
              🔗 Invite People
            </button>
          )}
          <button style={menuItemStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-500)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
            onClick={() => { onToggleMembers?.(); setHeaderMenu(false); }}>
            👥 Show Members
          </button>
          {myRole !== 'owner' && (
            <button style={{ ...menuItemStyle, color: 'var(--danger)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--danger)22'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              onClick={leaveServer}>
              🚪 Leave Server
            </button>
          )}
        </div>
      )}

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
        {groupByCategory(channels).map(group => {
          const catKey = group.label || '__default__';
          const isCollapsed = collapsedCats.has(catKey);
          const textChs  = group.channels.filter(c => !c.type || c.type === 'text');
          const voiceChs = group.channels.filter(c => c.type === 'voice');
          return (
            <div key={catKey}>
              {group.label && (
                <button
                  onClick={() => toggleCat(catKey)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    width: '100%', background: 'none', border: 'none',
                    padding: '16px 4px 4px', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}
                >
                  <span style={{ fontSize: 10 }}>{isCollapsed ? '▶' : '▼'}</span>
                  {group.label}
                </button>
              )}
              {!isCollapsed && (
                <>
                  {textChs.length > 0 && (
                    <>
                      {!group.label && (
                        <SectionHeader label="Text Channels" canAdd={canManage}
                          onAdd={() => { setNewType('text'); setNewCategory(''); setShowCreate(true); }} />
                      )}
                      {textChs.map(c => (
                        <ChannelItem key={c.id} channel={c} active={selectedId === c.id}
                          unreadCount={unread[c.id] || 0}
                          onClick={() => {
                            setUnread(prev => ({ ...prev, [c.id]: 0 }));
                            fetch(`/api/channels/${c.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
                            onSelect(c);
                          }} />
                      ))}
                    </>
                  )}
                  {voiceChs.length > 0 && (
                    <>
                      {!group.label && (
                        <SectionHeader label="Voice Channels" canAdd={canManage}
                          onAdd={() => { setNewType('voice'); setNewCategory(''); setShowCreate(true); }} />
                      )}
                      {voiceChs.map(c => (
                        <ChannelItem key={c.id} channel={c} active={selectedId === c.id}
                          unreadCount={0}
                          onClick={() => onSelectVoiceChannel?.(c)} />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Create channel modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 20 }}>Create Channel</h2>
            </div>
            <form onSubmit={createChannel}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="field-label">Channel type</label>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {['text', 'voice'].map(t => (
                      <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: newType === t ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        <input type="radio" name="chType" value={t} checked={newType === t} onChange={() => setNewType(t)} />
                        {t === 'text' ? '# Text' : '🔊 Voice'}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">Category <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="field-input"
                    placeholder="e.g. GENERAL"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="field-label">Channel name</label>
                  <input className="field-input"
                    placeholder={newType === 'text' ? 'general' : 'voice-chat'}
                    value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setNewCategory(''); setShowCreate(false); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Channel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvite && <InviteModal server={server} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
