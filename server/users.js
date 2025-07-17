const users = [
  {
    id: 1,
    email: 'admin@example.com',
    password: 'password',
    role: 'admin',
    name: 'Admin User',
  },
  {
    id: 2,
    email: 'user@example.com',
    password: 'password',
    role: 'user',
    name: 'Regular User',
  },
];

function findUser(email, password) {
  return users.find(
    (user) => user.email === email && user.password === password
  );
}

module.exports = {
  users,
  findUser,
};
