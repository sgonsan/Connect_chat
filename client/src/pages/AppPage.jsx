// client/src/pages/AppPage.jsx
import React, { useState } from 'react';
import ServerList  from '../components/ServerList';
import ChannelList from '../components/ChannelList';
import ChatArea    from '../components/ChatArea';
import VoiceArea   from '../components/VoiceArea';
import MemberList  from '../components/MemberList';

export default function AppPage() {
  const [selectedServer,       setSelectedServer]       = useState(null);
  const [selectedChannel,      setSelectedChannel]      = useState(null);
  const [selectedVoiceChannel, setSelectedVoiceChannel] = useState(null);
  const [showMembers,          setShowMembers]          = useState(false);

  const handleSelectServer = (server) => {
    setSelectedServer(server);
    setSelectedChannel(null);
    setSelectedVoiceChannel(null);
  };

  const activeSelectedId = selectedChannel?.id ?? selectedVoiceChannel?.id;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-700)', overflow: 'hidden' }}>
      <ServerList onSelect={handleSelectServer} selectedId={selectedServer?.id} />
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
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {selectedVoiceChannel ? (
          <VoiceArea channel={selectedVoiceChannel} onLeave={() => setSelectedVoiceChannel(null)} />
        ) : selectedChannel ? (
          <ChatArea channel={selectedChannel} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Selecciona un canal para comenzar
          </div>
        )}
        {showMembers && selectedServer && (
          <MemberList server={selectedServer} />
        )}
      </div>
    </div>
  );
}
