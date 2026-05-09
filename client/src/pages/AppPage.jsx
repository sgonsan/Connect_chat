// client/src/pages/AppPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ServerList  from '../components/ServerList';
import ChannelList from '../components/ChannelList';
import ChatArea    from '../components/ChatArea';
import VoiceArea   from '../components/VoiceArea';
import MemberList  from '../components/MemberList';
import DMList      from '../components/DMList';
import DMArea      from '../components/DMArea';

export default function AppPage() {
  const { token } = useAuth();
  const [selectedServer,       setSelectedServer]       = useState(null);
  const [selectedChannel,      setSelectedChannel]      = useState(null);
  const [selectedVoiceChannel, setSelectedVoiceChannel] = useState(null);
  const [showMembers,          setShowMembers]          = useState(false);
  const [dmMode,               setDmMode]               = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [dmRefresh,            setDmRefresh]            = useState(0);

  const handleSelectServer = (server) => {
    setSelectedServer(server);
    setSelectedChannel(null);
    setSelectedVoiceChannel(null);
    setDmMode(false);
  };

  const handleToggleDM = () => {
    setDmMode(v => !v);
    setSelectedConversation(null);
    setSelectedChannel(null);
    setSelectedVoiceChannel(null);
  };

  const handleOpenDM = async (targetUserId) => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: targetUserId }),
    });
    if (!res.ok) return;
    const { conversationId } = await res.json();
    // Fetch full conversation to get other_user info
    const listRes = await fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } });
    if (!listRes.ok) return;
    const convs = await listRes.json();
    const conv = convs.find(c => c.id === conversationId);
    if (conv) {
      setDmMode(true);
      setSelectedConversation(conv);
      setSelectedChannel(null);
      setSelectedVoiceChannel(null);
    }
  };

  const activeSelectedId = selectedChannel?.id ?? selectedVoiceChannel?.id;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-700)', overflow: 'hidden' }}>
      <ServerList
        onSelect={handleSelectServer}
        selectedId={selectedServer?.id}
        dmMode={dmMode}
        onToggleDM={handleToggleDM}
      />
      {dmMode ? (
        <DMList
          selectedId={selectedConversation?.id}
          onSelect={setSelectedConversation}
          refreshSignal={dmRefresh}
        />
      ) : (
        <ChannelList
          server={selectedServer}
          onSelect={(ch) => { setSelectedChannel(ch); setSelectedVoiceChannel(null); }}
          onSelectVoiceChannel={(ch) => { setSelectedVoiceChannel(ch); setSelectedChannel(null); }}
          selectedId={activeSelectedId}
          onToggleMembers={() => setShowMembers(v => !v)}
          onChannelDeleted={(channelId) => {
            if (selectedChannel?.id === channelId) setSelectedChannel(null);
            if (selectedVoiceChannel?.id === channelId) setSelectedVoiceChannel(null);
          }}
        />
      )}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {dmMode ? (
          <DMArea
            conversation={selectedConversation}
            onNewMessage={() => setDmRefresh(v => v + 1)}
          />
        ) : selectedVoiceChannel ? (
          <VoiceArea channel={selectedVoiceChannel} onLeave={() => setSelectedVoiceChannel(null)} />
        ) : selectedChannel ? (
          <ChatArea channel={selectedChannel} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Selecciona un canal para comenzar
          </div>
        )}
        {showMembers && selectedServer && !dmMode && (
          <MemberList server={selectedServer} onOpenDM={handleOpenDM} />
        )}
      </div>
    </div>
  );
}
