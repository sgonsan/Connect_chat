import React from 'react';
import {
  ParticipantContext,
  useParticipantInfo,
  useIsMuted,
  useIsSpeaking,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * Custom participant tile that wraps a participant in ParticipantContext
 * and renders video (if enabled) or a coloured avatar fallback.
 *
 * Props:
 *   participant  – LiveKit Participant object
 */
function ParticipantTileInner() {
  const { identity, name } = useParticipantInfo();
  const micMuted = useIsMuted(Track.Source.Microphone);
  const isSpeaking = useIsSpeaking();

  // Find the camera track for this participant via useTracks scoped to context
  const tracks = useTracks([Track.Source.Camera]);
  const cameraTrack = tracks.find(
    (t) => t.participant?.identity === identity && t.publication?.isSubscribed
  );
  const hasVideo = Boolean(cameraTrack && !cameraTrack.publication?.isMuted);

  // Generate a deterministic colour from the identity string
  const colours = [
    'bg-indigo-600', 'bg-purple-600', 'bg-pink-600', 'bg-red-600',
    'bg-orange-500', 'bg-teal-600', 'bg-cyan-600', 'bg-green-600',
  ];
  const colourIndex =
    identity.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % colours.length;
  const avatarColour = colours[colourIndex];

  const displayName = name || identity || '?';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl overflow-hidden bg-gray-800 ${
        isSpeaking ? 'ring-2 ring-green-400' : 'ring-1 ring-gray-700'
      }`}
      style={{ minHeight: '140px' }}
    >
      {/* Video layer */}
      {hasVideo && cameraTrack ? (
        <VideoTrack
          trackRef={cameraTrack}
          className="w-full h-full object-cover"
        />
      ) : (
        /* Avatar fallback */
        <div
          className={`flex items-center justify-center w-16 h-16 rounded-full ${avatarColour} text-white text-2xl font-bold select-none`}
        >
          {initial}
        </div>
      )}

      {/* Name overlay */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1 bg-black/50 text-white text-xs">
        <span className="truncate">{displayName}</span>
        {micMuted && (
          <svg
            className="w-3.5 h-3.5 text-red-400 flex-shrink-0 ml-1"
            fill="currentColor"
            viewBox="0 0 24 24"
            title="Microphone muted"
          >
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V20H9v2h6v-2h-2v-2.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
          </svg>
        )}
      </div>
    </div>
  );
}

export default function ParticipantTile({ participant }) {
  return (
    <ParticipantContext.Provider value={participant}>
      <ParticipantTileInner />
    </ParticipantContext.Provider>
  );
}
