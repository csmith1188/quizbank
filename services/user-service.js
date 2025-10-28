const { User } = require('../db/db');

async function findUserByFbId(id) {
  if (typeof id === 'undefined') {
    throw new Error('id is undefined!');
  }
  return await User.findOne({ where: { fb_id: id } });
}

async function createUser(id, username, email) {
  let user = await User.findOne({ where: { fb_id: id } });
  if (!user) {
    user = await User.create({ fb_id: id, username, email });
  }
  return user;
}

async function findUserByUsername(username) {
  return await User.findOne({ where: { username } });
}

async function findUserByEmail(email) {
  return await User.findOne({ where: { email } });
}

module.exports = {
  findUserByFbId,
  createUser,
  findUserByUsername,
  findUserByEmail
};