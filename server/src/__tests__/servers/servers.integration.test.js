// server/src/__tests__/servers/servers.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let tokenAlice, tokenBob, serverId, inviteCode;

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens, servers, server_members, channels, messages CASCADE');

  const resA = await request(app).post('/api/auth/register')
    .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });
  tokenAlice = resA.body.accessToken;

  const resB = await request(app).post('/api/auth/register')
    .send({ username: 'bob', email: 'bob@test.com', password: 'password123' });
  tokenBob = resB.body.accessToken;
});

describe('POST /api/servers', () => {
  it('creates a server and makes creator owner', async () => {
    const res = await request(app).post('/api/servers')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ name: 'Test Server' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Server');
    serverId = res.body.id;
    inviteCode = res.body.invite_code;
  });
});

describe('GET /api/servers/:id', () => {
  it('returns server with channels for members', async () => {
    const res = await request(app).get(`/api/servers/${serverId}`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('channels');
  });

  it('returns 403 for non-members', async () => {
    const res = await request(app).get(`/api/servers/${serverId}`)
      .set('Authorization', `Bearer ${tokenBob}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/servers/join', () => {
  it('lets bob join with invite code', async () => {
    const res = await request(app).post('/api/servers/join')
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ invite_code: inviteCode });
    expect(res.status).toBe(200);
  });

  it('returns 409 if already member', async () => {
    const res = await request(app).post('/api/servers/join')
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ invite_code: inviteCode });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/servers/:id/leave', () => {
  it('lets bob leave the server', async () => {
    const res = await request(app).delete(`/api/servers/${serverId}/leave`)
      .set('Authorization', `Bearer ${tokenBob}`);
    expect(res.status).toBe(204);
  });

  it('prevents owner from leaving', async () => {
    const res = await request(app).delete(`/api/servers/${serverId}/leave`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    expect(res.status).toBe(400);
  });
});
