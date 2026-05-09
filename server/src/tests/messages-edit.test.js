const request = require('supertest');
const app     = require('../app');
const pool    = require('../db');

let token, userId, serverId, channelId, messageId;
let token2, userId2, messageId2;

beforeAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE 'edit-test%'");

  // User 1
  let res = await request(app).post('/api/auth/register')
    .send({ username: 'edituser1', email: 'edit-test1@x.com', password: 'Pass1234!' });
  token  = res.body.accessToken;
  userId = res.body.user.id;

  // User 2
  res = await request(app).post('/api/auth/register')
    .send({ username: 'edituser2', email: 'edit-test2@x.com', password: 'Pass1234!' });
  token2  = res.body.accessToken;
  userId2 = res.body.user.id;

  // Server + channel
  res = await request(app).post('/api/servers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Edit Test Server' });
  serverId = res.body.id;

  res = await request(app).post(`/api/servers/${serverId}/channels`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'general', type: 'text' });
  channelId = res.body.id;

  // Messages
  res = await request(app).post(`/api/channels/${channelId}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .send({ content: 'original message' });
  messageId = res.body.id;
});

afterAll(() => pool.query("DELETE FROM users WHERE email LIKE 'edit-test%'"));

describe('PATCH /api/messages/:id', () => {
  it('edits own message', async () => {
    const res = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'edited content' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('edited content');
    expect(res.body.edited_at).toBeTruthy();
  });

  it('rejects empty content', async () => {
    const res = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });
    expect(res.status).toBe(400);
  });

  it('cannot edit another user message', async () => {
    const res = await request(app)
      .patch(`/api/messages/${messageId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ content: 'stolen edit' });
    expect(res.status).toBe(403);
  });
});
