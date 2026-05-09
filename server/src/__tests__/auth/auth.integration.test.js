// server/src/__tests__/auth/auth.integration.test.js
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db');

beforeAll(async () => {
  await pool.query('TRUNCATE users, refresh_tokens CASCADE');
});

describe('POST /api/auth/register', () => {
  it('creates user and returns access token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).toMatchObject({ username: 'alice', email: 'alice@test.com' });
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 409 on duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice2', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('returns 400 on invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a', email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns access token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns new access token using refresh cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'password123' });

    const cookie = loginRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh token cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'password123' });

    const cookie = loginRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(res.status).toBe(204);
  });

  it('returns 204 even without refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.status).toBe(204);
  });
});
