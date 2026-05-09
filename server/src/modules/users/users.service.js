// server/src/modules/users/users.service.js
const usersRepo = require('./users.repository');
const { createError } = require('../../middleware/errorHandler');

async function getMe(userId) {
  const user = await usersRepo.findById(userId);
  if (!user) throw createError(404, 'User not found');
  return user;
}

async function updateMe(userId, fields) {
  const user = await usersRepo.updateUser(userId, fields);
  if (!user) throw createError(404, 'User not found');
  return user;
}

module.exports = { getMe, updateMe };
