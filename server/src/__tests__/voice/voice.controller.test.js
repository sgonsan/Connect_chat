// server/src/__tests__/voice/voice.controller.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let tokenOwner, tokenOutsider, serverId, voiceChannelId, textChannelId;

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens, servers, server_members, channels, messages CASCADE');

  const resOwner = await request(app).post('/api/auth/register')
    .send({ username: 'voiceowner', email: 'voiceowner@test.com', password: 'password123' });
  tokenOwner = resOwner.body.accessToken;

  const resOutsider = await request(app).post('/api/auth/register')
    .send({ username: 'outsider', email: 'outsider@test.com', password: 'password123' });
  tokenOutsider = resOutsider.body.accessToken;

  const resServer = await request(app).post('/api/servers')
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'Voice Test Server' });
  serverId = resServer.body.id;

  const resVoice = await request(app)
    .post(`/api/servers/${serverId}/channels`)
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'voice-general', type: 'voice' });
  voiceChannelId = resVoice.body.id;

  const resText = await request(app)
    .post(`/api/servers/${serverId}/channels`)
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'text-general', type: 'text' });
  textChannelId = resText.body.id;
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/voice/token', () => {
  it('returns 200 with token and livekitUrl for valid voice channel', async () => {
    const res = await request(app)
      .post('/api/voice/token')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ channelId: voiceChannelId });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('livekitUrl');
  });

  it('returns 404 for non-existent channelId', async () => {
    const res = await request(app)
      .post('/api/voice/token')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ channelId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for a text channel (not voice)', async () => {
    const res = await request(app)
      .post('/api/voice/token')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ channelId: textChannelId });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This channel is not a voice channel');
  });

  it('returns 403 for a user who is not a member of the server', async () => {
    const res = await request(app)
      .post('/api/voice/token')
      .set('Authorization', `Bearer ${tokenOutsider}`)
      .send({ channelId: voiceChannelId });
    expect(res.status).toBe(403);
  });

  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .post('/api/voice/token')
      .send({ channelId: voiceChannelId });
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid UUID channelId', async () => {
    const res = await request(app)
      .post('/api/voice/token')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ channelId: 'not-a-valid-uuid' });
    expect(res.status).toBe(400);
  });
});
