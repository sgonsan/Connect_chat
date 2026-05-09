// server/src/__tests__/users/users.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

let token;

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens CASCADE');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'tester', email: 'tester@test.com', password: 'password123' });
  token = res.body.accessToken;
});

describe('GET /api/users/me', () => {
  it('returns the authenticated user', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'tester', email: 'tester@test.com' });
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  it('updates the username', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'tester_updated' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('tester_updated');
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .send({ username: 'nope' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when no fields provided', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
