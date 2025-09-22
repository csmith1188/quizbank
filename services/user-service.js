const { User } = require('../db/models');

async function findUserById(id) {
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

module.exports = {
  findUserById,
  createUser,
  findUserByUsername,
};