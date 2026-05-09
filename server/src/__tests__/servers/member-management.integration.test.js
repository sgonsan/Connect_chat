const request = require('supertest');
const app     = require('../../app');
const pool    = require('../../db');

let ownerToken, memberToken, owner, member, server;

beforeAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE '%@mgmt-test.com'");

  const r1 = await request(app).post('/api/auth/register').send({ username: 'mgmt_owner', email: 'owner@mgmt-test.com', password: 'Pass1234!' });
  ownerToken = r1.body.accessToken;
  owner = r1.body.user;

  const r2 = await request(app).post('/api/auth/register').send({ username: 'mgmt_member', email: 'member@mgmt-test.com', password: 'Pass1234!' });
  memberToken = r2.body.accessToken;
  member = r2.body.user;

  const rs = await request(app).post('/api/servers').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'MgmtServer' });
  server = rs.body;

  await request(app).post('/api/servers/join').set('Authorization', `Bearer ${memberToken}`).send({ invite_code: server.invite_code });
});

afterAll(() => pool.query("DELETE FROM users WHERE email LIKE '%@mgmt-test.com'"));

describe('GET /api/servers/:id/members', () => {
  it('returns members with roles', async () => {
    const res = await request(app).get(`/api/servers/${server.id}/members`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'owner', username: 'mgmt_owner' }),
      expect.objectContaining({ role: 'member', username: 'mgmt_member' }),
    ]));
  });

  it('rejects non-members', async () => {
    const r = await request(app).post('/api/auth/register').send({ username: 'mgmt_out', email: 'out@mgmt-test.com', password: 'Pass1234!' });
    const res = await request(app).get(`/api/servers/${server.id}/members`).set('Authorization', `Bearer ${r.body.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/servers/:id/members/:userId/role', () => {
  it('owner can promote member to moderator', async () => {
    const res = await request(app)
      .patch(`/api/servers/${server.id}/members/${member.id}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'moderator' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('moderator');
  });

  it('owner can demote moderator to member', async () => {
    const res = await request(app)
      .patch(`/api/servers/${server.id}/members/${member.id}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'member' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('member');
  });

  it('non-owner cannot change roles', async () => {
    const res = await request(app)
      .patch(`/api/servers/${server.id}/members/${member.id}/role`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: 'moderator' });
    expect(res.status).toBe(403);
  });

  it('cannot change owner role', async () => {
    const res = await request(app)
      .patch(`/api/servers/${server.id}/members/${owner.id}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'member' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/servers/:id/members/:userId (kick)', () => {
  it('owner can kick a member', async () => {
    const r = await request(app).post('/api/auth/register').send({ username: 'mgmt_kick', email: 'kick@mgmt-test.com', password: 'Pass1234!' });
    const kickUser = r.body.user;
    await request(app).post('/api/servers/join').set('Authorization', `Bearer ${r.body.accessToken}`).send({ invite_code: server.invite_code });
    const res = await request(app).delete(`/api/servers/${server.id}/members/${kickUser.id}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(204);
  });

  it('cannot kick the owner', async () => {
    const res = await request(app).delete(`/api/servers/${server.id}/members/${owner.id}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });
});
