// server/src/__tests__/middleware/authenticate.test.js
const authenticate = require('../../middleware/authenticate');
const { signAccessToken } = require('../../config/jwt');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticate middleware', () => {
  it('calls next and attaches req.user on valid token', () => {
    const token = signAccessToken({ userId: 'user-1' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ userId: 'user-1' });
  });

  it('returns 401 when no token provided', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 on invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalidtoken' } };
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
