-- Add voice channel support
ALTER TABLE channels
ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'text'
CHECK (type IN ('text', 'voice'));

CREATE INDEX IF NOT EXISTS idx_channels_type_server
ON channels(server_id, type);
