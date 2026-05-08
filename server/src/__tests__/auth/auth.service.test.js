jest.mock('../../modules/auth/auth.repository');

const authRepo = require('../../modules/auth/auth.repository');
const authService = require('../../modules/auth/auth.service');

describe('authService.register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hashes the password before storing', async () => {
    authRepo.findUserByEmail.mockResolvedValue(null);
    authRepo.createUser.mockResolvedValue({
      id: 'user-1', username: 'alice', email: 'alice@test.com',
    });
    authRepo.createRefreshToken.mockResolvedValue();

    const result = await authService.register({
      username: 'alice', email: 'alice@test.com', password: 'secret123',
    });

    expect(authRepo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: expect.not.stringContaining('secret123'),
      })
    );
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result).toHaveProperty('user');
  });

  it('throws 409 if email already exists', async () => {
    authRepo.findUserByEmail.mockResolvedValue({ id: 'existing' });

    await expect(
      authService.register({ username: 'bob', email: 'taken@test.com', password: 'secret123' })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('authService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns tokens on valid credentials', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('mypassword', 1);
    authRepo.findUserByEmail.mockResolvedValue({
      id: 'user-1', username: 'alice', email: 'alice@test.com',
      password_hash: hash,
    });
    authRepo.createRefreshToken.mockResolvedValue();

    const result = await authService.login({ email: 'alice@test.com', password: 'mypassword' });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('throws 401 on wrong password', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('correctpassword', 1);
    authRepo.findUserByEmail.mockResolvedValue({
      id: 'user-1', password_hash: hash,
    });

    await expect(
      authService.login({ email: 'alice@test.com', password: 'wrongpassword' })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 if user not found', async () => {
    authRepo.findUserByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@test.com', password: 'any' })
    ).rejects.toMatchObject({ status: 401 });
  });
});
