const request = require('supertest');
const app     = require('../app');
const pool    = require('../db');

let token, serverId, channelId, messageId;

beforeAll(async () => {
  await pool.query("DELETE FROM users WHERE email = 'react-test@x.com'");
  let res = await request(app).post('/api/auth/register')
    .send({ username: 'reactuser', email: 'react-test@x.com', password: 'Pass1234!' });
  token = res.body.accessToken;

  res = await request(app).post('/api/servers').set('Authorization', `Bearer ${token}`).send({ name: 'React Test Server' });
  serverId = res.body.id;

  res = await request(app).post(`/api/servers/${serverId}/channels`).set('Authorization', `Bearer ${token}`).send({ name: 'general', type: 'text' });
  channelId = res.body.id;

  res = await request(app).post(`/api/channels/${channelId}/messages`).set('Authorization', `Bearer ${token}`).send({ content: 'hello' });
  messageId = res.body.id;
});

afterAll(() => pool.query("DELETE FROM users WHERE email = 'react-test@x.com'"));

describe('POST /api/messages/:id/reactions/:emoji', () => {
  it('adds a reaction', async () => {
    const res = await request(app)
      .post(`/api/messages/${messageId}/reactions/👍`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reactions).toEqual(
      expect.arrayContaining([expect.objectContaining({ emoji: '👍' })])
    );
  });

  it('toggles (removes) existing reaction', async () => {
    const res = await request(app)
      .post(`/api/messages/${messageId}/reactions/👍`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const r = res.body.reactions.find(r => r.emoji === '👍');
    expect(r).toBeUndefined();
  });
});
