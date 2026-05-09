import React from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';

export default function VoiceControls({ onLeave }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  const micEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const cameraEnabled = localParticipant?.isCameraEnabled ?? false;

  const toggleMic = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!micEnabled);
    }
  };

  const toggleCamera = async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(!cameraEnabled);
    }
  };

  const handleLeave = async () => {
    await room.disconnect();
    if (onLeave) onLeave();
  };

  const btnBase =
    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900';

  return (
    <div className="flex items-center justify-center gap-4 px-6 py-3 bg-gray-900 border-t border-gray-700">
      {/* Mic toggle */}
      <button
        onClick={toggleMic}
        className={`${btnBase} ${
          micEnabled
            ? 'bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-500'
            : 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500'
        }`}
        title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        {micEnabled ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V20H9v2h6v-2h-2v-2.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
          </svg>
        )}
        <span className="hidden sm:inline">{micEnabled ? 'Mute' : 'Unmute'}</span>
      </button>

      {/* Camera toggle */}
      <button
        onClick={toggleCamera}
        className={`${btnBase} ${
          cameraEnabled
            ? 'bg-gray-700 hover:bg-gray-600 text-white focus:ring-gray-500'
            : 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500'
        }`}
        title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {cameraEnabled ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
          </svg>
        )}
        <span className="hidden sm:inline">{cameraEnabled ? 'Stop Video' : 'Start Video'}</span>
      </button>

      {/* Leave */}
      <button
        onClick={handleLeave}
        className={`${btnBase} bg-red-700 hover:bg-red-600 text-white focus:ring-red-500`}
        title="Leave voice channel"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
        </svg>
        <span>Leave</span>
      </button>
    </div>
  );
}
