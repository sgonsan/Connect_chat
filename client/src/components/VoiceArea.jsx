import React, { useEffect, useState, useCallback } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
} from '@livekit/components-react';
import { useAuth } from '../context/AuthContext';
import ParticipantTile from './ParticipantTile';
import VoiceControls from './VoiceControls';

/** Inner grid — must be rendered inside <LiveKitRoom> so hooks have room context. */
function VoiceGrid({ channel, onLeave }) {
  const participants = useParticipants();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Participant grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {participants.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No other participants yet. Invite someone to join!
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))`,
            }}
          >
            {participants.map((p) => (
              <ParticipantTile key={p.identity} participant={p} />
            ))}
          </div>
        )}
      </div>

      {/* Audio renderer (plays remote audio tracks) */}
      <RoomAudioRenderer />

      {/* Controls bar */}
      <VoiceControls onLeave={onLeave} />
    </div>
  );
}

/**
 * VoiceArea – main component for voice/video channels.
 *
 * Props:
 *   channel     – channel object { id, name, ... }
 *   onLeave     – optional callback when user leaves the room
 */
export default function VoiceArea({ channel, onLeave }) {
  const { token: authToken } = useAuth();

  const [livekitToken, setLivekitToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [joined, setJoined] = useState(false);

  // Fetch LiveKit token when channel changes
  useEffect(() => {
    if (!channel?.id) return;

    // Reset state on channel switch
    setLivekitToken(null);
    setLivekitUrl(null);
    setError(null);
    setJoined(false);
  }, [channel?.id]);

  const fetchToken = useCallback(async () => {
    if (!channel?.id || !authToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/voice/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ channelId: channel.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to connect to voice channel');
      }
      setLivekitToken(data.token);
      setLivekitUrl(data.livekitUrl);
      setJoined(true);
    } catch (err) {
      setError(err.message || 'Failed to connect to voice channel');
    } finally {
      setLoading(false);
    }
  }, [channel?.id, authToken]);

  const handleLeave = useCallback(() => {
    setJoined(false);
    setLivekitToken(null);
    setLivekitUrl(null);
    if (onLeave) onLeave();
  }, [onLeave]);

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select a voice channel to join.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-850">
      {/* Channel header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 bg-gray-800 flex-shrink-0">
        <span className="text-lg">🔊</span>
        <h2 className="font-semibold text-white text-base truncate">{channel.name}</h2>
        {joined && (
          <span className="ml-2 text-xs text-green-400 font-medium">● Live</span>
        )}
      </div>

      {/* Body */}
      {!joined ? (
        /* Pre-join screen */
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6">
          {error && (
            <div className="w-full max-w-sm bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm text-center">
              {error}
            </div>
          )}
          <p className="text-gray-400 text-sm text-center">
            You are not connected to this voice channel.
          </p>
          <button
            onClick={fetchToken}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Connecting…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2z" />
                </svg>
                Join Voice
              </>
            )}
          </button>
        </div>
      ) : (
        /* Live room */
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={livekitToken}
          video={true}
          audio={true}
          onDisconnected={handleLeave}
          className="flex flex-col flex-1 min-h-0"
        >
          <VoiceGrid channel={channel} onLeave={handleLeave} />
        </LiveKitRoom>
      )}
    </div>
  );
}
