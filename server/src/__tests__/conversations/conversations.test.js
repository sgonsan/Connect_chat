const request = require('supertest');
const app     = require('../../app');
const pool    = require('../../db');

let token1, userId1, token2, userId2, convId;

beforeAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE 'conv-test%'");
  let r = await request(app).post('/api/auth/register').send({ username: 'convuser1', email: 'conv-test1@x.com', password: 'Pass1234!' });
  token1 = r.body.accessToken; userId1 = r.body.user.id;
  r = await request(app).post('/api/auth/register').send({ username: 'convuser2', email: 'conv-test2@x.com', password: 'Pass1234!' });
  token2 = r.body.accessToken; userId2 = r.body.user.id;
});

afterAll(() => pool.query("DELETE FROM users WHERE email LIKE 'conv-test%'"));

describe('Conversations', () => {
  it('opens a new conversation', async () => {
    const res = await request(app).post('/api/conversations').set('Authorization', `Bearer ${token1}`).send({ userId: userId2 });
    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBeTruthy();
    convId = res.body.conversationId;
  });

  it('opening again returns same conversation', async () => {
    const res = await request(app).post('/api/conversations').set('Authorization', `Bearer ${token1}`).send({ userId: userId2 });
    expect(res.body.conversationId).toBe(convId);
  });

  it('lists conversations', async () => {
    const res = await request(app).get('/api/conversations').set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].other_user.username).toBe('convuser2');
  });

  it('fetches empty messages', async () => {
    const res = await request(app).get(`/api/conversations/${convId}/messages`).set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
