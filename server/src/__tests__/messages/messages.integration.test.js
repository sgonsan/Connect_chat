// server/src/__tests__/messages/messages.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let tokenOwner, tokenOther, channelId, messageId;

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens, servers, server_members, channels, messages CASCADE');

  const resO = await request(app).post('/api/auth/register')
    .send({ username: 'msgowner', email: 'msgowner@test.com', password: 'password123' });
  tokenOwner = resO.body.accessToken;

  const resOther = await request(app).post('/api/auth/register')
    .send({ username: 'other', email: 'other@test.com', password: 'password123' });
  tokenOther = resOther.body.accessToken;

  const resS = await request(app).post('/api/servers')
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'Msg Server' });
  const serverId = resS.body.id;

  const resC = await request(app).post(`/api/servers/${serverId}/channels`)
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'general' });
  channelId = resC.body.id;

  const messagesRepo = require('../../modules/messages/messages.repository');
  const ownerRow = await pool.query("SELECT id FROM users WHERE username='msgowner'");
  await messagesRepo.createMessage({
    channelId,
    userId: ownerRow.rows[0].id,
    content: 'setup message',
  });
});

describe('GET /api/channels/:id/messages', () => {
  it('returns message history for members', async () => {
    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const msg = res.body[0];
    expect(msg).toHaveProperty('user');
    expect(msg.user).not.toHaveProperty('password_hash');
    expect(msg.user).toHaveProperty('username');
  });

  it('returns 403 for non-members', async () => {
    const res = await request(app)
      .get(`/api/channels/${channelId}/messages`)
      .set('Authorization', `Bearer ${tokenOther}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/messages/:id', () => {
  beforeAll(async () => {
    const messagesRepo = require('../../modules/messages/messages.repository');
    const msg = await messagesRepo.createMessage({
      channelId,
      userId: (await pool.query("SELECT id FROM users WHERE username='msgowner'")).rows[0].id,
      content: 'hello',
    });
    messageId = msg.id;
  });

  it('owner can delete their own message', async () => {
    const res = await request(app)
      .delete(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(res.status).toBe(204);
  });
});
