import React, { useState } from 'react';
import ServerList from '../components/ServerList';
import ChannelList from '../components/ChannelList';
import ChatArea from '../components/ChatArea';
import VoiceArea from '../components/VoiceArea';
export default function AppPage() {
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedVoiceChannel, setSelectedVoiceChannel] = useState(null);
  const handleSelectServer = (server) => { setSelectedServer(server); setSelectedChannel(null); setSelectedVoiceChannel(null); };
  const handleSelectChannel = (channel) => { setSelectedChannel(channel); setSelectedVoiceChannel(null); };
  const handleSelectVoiceChannel = (channel) => { setSelectedVoiceChannel(channel); setSelectedChannel(null); };
  const activeSelectedId = selectedChannel?.id ?? selectedVoiceChannel?.id;
  return (
    <div className="flex h-screen">
      <ServerList onSelect={handleSelectServer} selectedId={selectedServer?.id} />
      <ChannelList
        server={selectedServer}
        onSelect={handleSelectChannel}
        onSelectVoiceChannel={handleSelectVoiceChannel}
        selectedId={activeSelectedId}
      />
      {selectedVoiceChannel ? (
        <VoiceArea channel={selectedVoiceChannel} onLeave={() => setSelectedVoiceChannel(null)} />
      ) : selectedChannel ? (
        <ChatArea channel={selectedChannel} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">Select a channel to start</div>
      )}
    </div>
  );
}
