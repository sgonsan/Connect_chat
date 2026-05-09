// server/src/modules/users/users.controller.js
const usersService = require('./users.service');

async function getMe(req, res, next) {
  try {
    const user = await usersService.getMe(req.user.userId);
    res.json(user);
  } catch (err) { next(err); }
}

async function updateMe(req, res, next) {
  try {
    const user = await usersService.updateMe(req.user.userId, req.body);
    res.json(user);
  } catch (err) { next(err); }
}

module.exports = { getMe, updateMe };
