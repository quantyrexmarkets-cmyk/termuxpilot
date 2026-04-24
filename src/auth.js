const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'termuxpilot-secret-key-change-in-production';
const USERS_FILE = path.join(__dirname, '..', 'users.json');

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
  } catch (e) { return []; }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {}
}

async function register(email, password, name) {
  const users = loadUsers();
  if (!email || !password) return { error: 'Email and password required' };
  if (!email.includes('@')) return { error: 'Invalid email' };
  if (password.length < 6) return { error: 'Password min 6 chars' };
  const exists = users.find(u => u.email === email.toLowerCase());
  if (exists) return { error: 'Email already registered' };
  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: 'u_' + Date.now(),
    email: email.toLowerCase(),
    name: name || email.split('@')[0],
    password: hash,
    createdAt: new Date()
  };
  users.push(user);
  saveUsers(users);
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: '30d' });
  return { success: true, token, user: { id: user.id, email: user.email, name: user.name } };
}

async function login(email, password) {
  if (!email || !password) return { error: 'Email and password required' };
  const users = loadUsers();
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return { error: 'Invalid credentials' };
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return { error: 'Invalid credentials' };
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, SECRET, { expiresIn: '30d' });
  return { success: true, token, user: { id: user.id, email: user.email, name: user.name } };
}

function verify(token) {
  try { return jwt.verify(token, SECRET); }
  catch (e) { return null; }
}

function middleware(req, res, next) {
  // Simply pass through - no blocking
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    req.user = verify(auth.slice(7));
  } else {
    req.user = null;
  }
  next();
}

function getWorkspace(userId) {
  const workDir = path.join(__dirname, '..', 'workspaces', userId || 'guest');
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
  return workDir;
}

module.exports = { register, login, verify, middleware, getWorkspace };
