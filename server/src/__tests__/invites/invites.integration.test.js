const request = require('supertest');
const app     = require('../../app');
const pool    = require('../../db');

let ownerToken, memberToken, outsiderToken, server;

beforeAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE '%@inv-test.com'");

  const r1 = await request(app).post('/api/auth/register').send({ username: 'inv_owner', email: 'owner@inv-test.com', password: 'Pass1234!' });
  ownerToken = r1.body.accessToken;

  const r2 = await request(app).post('/api/auth/register').send({ username: 'inv_member', email: 'member@inv-test.com', password: 'Pass1234!' });
  memberToken = r2.body.accessToken;

  const r3 = await request(app).post('/api/auth/register').send({ username: 'inv_outside', email: 'outside@inv-test.com', password: 'Pass1234!' });
  outsiderToken = r3.body.accessToken;

  const rs = await request(app).post('/api/servers').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'InvServer' });
  server = rs.body;
  await request(app).post('/api/servers/join').set('Authorization', `Bearer ${memberToken}`).send({ invite_code: server.invite_code });
});

afterAll(() => pool.query("DELETE FROM users WHERE email LIKE '%@inv-test.com'"));

describe('POST /api/servers/:id/invites', () => {
  it('owner can create invite with expiry and maxUses', async () => {
    const res = await request(app)
      .post(`/api/servers/${server.id}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expiresIn: 24, maxUses: 10 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ code: expect.any(String), url: expect.stringContaining('/invite/') });
    expect(res.body.maxUses).toBe(10);
    expect(res.body.expiresAt).toBeTruthy();
  });

  it('owner can create invite with no expiry', async () => {
    const res = await request(app)
      .post(`/api/servers/${server.id}/invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.expiresAt).toBeNull();
    expect(res.body.maxUses).toBeNull();
  });

  it('non-member cannot create invite', async () => {
    const res = await request(app)
      .post(`/api/servers/${server.id}/invites`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('regular member cannot create invite', async () => {
    const res = await request(app)
      .post(`/api/servers/${server.id}/invites`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('GET /api/invites/:code', () => {
  let inviteCode;
  beforeAll(async () => {
    const res = await request(app).post(`/api/servers/${server.id}/invites`).set('Authorization', `Bearer ${ownerToken}`).send({});
    inviteCode = res.body.code;
  });

  it('returns server preview without auth', async () => {
    const res = await request(app).get(`/api/invites/${inviteCode}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ serverName: 'InvServer', memberCount: expect.any(Number) });
  });

  it('returns 404 for unknown code', async () => {
    const res = await request(app).get('/api/invites/nonexistent99');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/invites/:code/join', () => {
  let inviteCode;
  beforeAll(async () => {
    const res = await request(app).post(`/api/servers/${server.id}/invites`).set('Authorization', `Bearer ${ownerToken}`).send({ maxUses: 1 });
    inviteCode = res.body.code;
  });

  it('outsider can join via invite', async () => {
    const res = await request(app).post(`/api/invites/${inviteCode}/join`).set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ serverId: server.id });
  });

  it('returns 409 if already a member', async () => {
    const res = await request(app).post(`/api/invites/${inviteCode}/join`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(409);
  });

  it('returns 410 when maxUses exhausted', async () => {
    const res = await request(app).post(`/api/invites/${inviteCode}/join`).set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(410);
  });
});
