// server/src/__tests__/channels/channels.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let tokenOwner, tokenMember, serverId, channelId;

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens, servers, server_members, channels, messages CASCADE');

  const resO = await request(app).post('/api/auth/register')
    .send({ username: 'owner', email: 'owner@test.com', password: 'password123' });
  tokenOwner = resO.body.accessToken;

  const resM = await request(app).post('/api/auth/register')
    .send({ username: 'member', email: 'member@test.com', password: 'password123' });
  tokenMember = resM.body.accessToken;

  const resS = await request(app).post('/api/servers')
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'Test Server' });
  serverId = resS.body.id;
  const inviteCode = resS.body.invite_code;

  await request(app).post('/api/servers/join')
    .set('Authorization', `Bearer ${tokenMember}`)
    .send({ invite_code: inviteCode });
});

describe('POST /api/servers/:id/channels', () => {
  it('owner can create a channel', async () => {
    const res = await request(app)
      .post(`/api/servers/${serverId}/channels`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'general' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('general');
    channelId = res.body.id;
  });

  it('member cannot create a channel', async () => {
    const res = await request(app)
      .post(`/api/servers/${serverId}/channels`)
      .set('Authorization', `Bearer ${tokenMember}`)
      .send({ name: 'random' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/channels/:id', () => {
  it('owner can delete a channel', async () => {
    const res = await request(app)
      .delete(`/api/channels/${channelId}`)
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(res.status).toBe(204);
  });
});
