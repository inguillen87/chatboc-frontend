const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[authStore] No se pudieron cargar usuarios persistidos', err);
    return [];
  }
}

let users = loadUsers();
const authTokens = new Map();

function persistUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function getNextId() {
  return users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1;
}

function getOrCreateEntityToken(user) {
  if (user.entity_token) return user.entity_token;
  const token = crypto.randomBytes(32).toString('base64url');
  user.entity_token = token;
  persistUsers();
  return token;
}

function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  return users.find((u) => normalizeEmail(u.email) === normalized) || null;
}

function createUser({ name, email, password, tenantSlug, rol, tipo_chat }) {
  if (!email || !password) {
    throw new Error('Email y contraseña son obligatorios.');
  }

  if (findUserByEmail(email)) {
    throw new Error('El usuario ya existe.');
  }

  const user = {
    id: getNextId(),
    name: name || email,
    email: normalizeEmail(email),
    password: password || '',
    rol: rol || 'admin',
    tenant_slug: tenantSlug || normalizeEmail(email).split('@')[0] || 'demo',
    tipo_chat: tipo_chat || 'municipio',
    plan: 'full',
  };

  user.entity_token = getOrCreateEntityToken(user);
  users.push(user);
  persistUsers();
  return user;
}

function issueAuthToken(user) {
  const token = crypto.randomBytes(24).toString('base64url');
  authTokens.set(token, user.id);
  return token;
}

function findUserByAuthToken(token) {
  const userId = authTokens.get(token);
  if (!userId) return null;
  return users.find((u) => u.id === userId) || null;
}

function updateUser(user) {
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx !== -1) {
    users[idx] = user;
    persistUsers();
  }
}

function seedDemoUser() {
  if (users.length > 0) return;
  const demo = {
    id: getNextId(),
    name: 'Demo Admin',
    email: 'admin@chatboc.local',
    password: 'admin',
    rol: 'admin',
    tenant_slug: 'demo',
    tipo_chat: 'municipio',
    plan: 'full',
  };
  demo.entity_token = getOrCreateEntityToken(demo);
  users.push(demo);
  persistUsers();
}

seedDemoUser();

module.exports = {
  getUsers: () => users,
  findUserByEmail,
  createUser,
  issueAuthToken,
  findUserByAuthToken,
  getOrCreateEntityToken,
  updateUser,
};
