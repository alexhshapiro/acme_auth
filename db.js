const Sequelize = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const JWT = process.env.JWT;

const { STRING } = Sequelize;
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define('user', {
  username: STRING,
  password: STRING,
});

const Note = conn.define('note', {
  text: STRING,
});

Note.belongsTo(User);
User.hasMany(Note);

User.byToken = async (token) => {
  try {
    const verifyToken = jwt.verify(token, JWT);
    const { userId } = verifyToken;
    const user = await User.findByPk(userId);
    if (user) {
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });

  let validate = await bcrypt.compare(password, user.password);

  if (validate) {
    const userId = user.id;
    const token = jwt.sign({ userId }, JWT);
    return token;
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];

  const notes = [
    { text: 'Hello there.', userId: 1 },
    { text: 'I am here.', userId: 2 },
    { text: 'Are you?.', userId: 3 },
    { text: 'Yes I am.', userId: 1 },
  ];

  const credUpdate = await Promise.all(
    credentials.map(async (credential) => {
      credential.password = await bcrypt.hash(credential.password, 8);
      return credential;
    })
  );
  const [lucy, moe, larry] = await Promise.all(
    credUpdate.map((credential) => User.create(credential))
  );

  await Promise.all(notes.map((note) => Note.create(note)));
  return {
    users: {
      lucy,
      moe,
      larry,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
