import React, { useState } from 'react';
import ServerList from '../components/ServerList';
import ChannelList from '../components/ChannelList';
import ChatArea from '../components/ChatArea';
export default function AppPage() {
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const handleSelectServer = (server) => { setSelectedServer(server); setSelectedChannel(null); };
  return (
    <div className="flex h-screen">
      <ServerList onSelect={handleSelectServer} selectedId={selectedServer?.id} />
      <ChannelList server={selectedServer} onSelect={setSelectedChannel} selectedId={selectedChannel?.id} />
      <ChatArea channel={selectedChannel} />
    </div>
  );
}
