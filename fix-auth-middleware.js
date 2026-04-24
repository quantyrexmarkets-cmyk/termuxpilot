const fs=require('fs');
const f=__dirname+'/src/auth.js';
let s=fs.readFileSync(f,'utf8');

// Fix middleware to allow more paths
const oldMiddleware=`// Middleware
function middleware(req, res, next) {
  // Skip auth for login/register/public
  const open = ['/api/auth/login', '/api/auth/register', '/health'];
  if (open.includes(req.path)) return next();
  if (req.path === '/' || req.path.startsWith('/index') || !req.path.startsWith('/api')) return next();

  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.query.token;

  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const user = verify(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });

  req.user = user;
  next();
}`;

const newMiddleware=`// Middleware
function middleware(req, res, next) {
  // Allow everything for now - auth is optional
  const open = [
    '/api/auth/login',
    '/api/auth/register',
    '/health'
  ];

  // Skip auth for open routes
  if (open.includes(req.path)) return next();

  // Skip auth for all non-API routes (HTML, CSS, JS)
  if (!req.path.startsWith('/api')) return next();

  // Check for token
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : req.query.token;

  // If no token just continue as guest
  if (!token) { req.user = null; return next(); }

  const user = verify(token);
  req.user = user || null;
  next();
}`;

s=s.replace(oldMiddleware, newMiddleware);
fs.writeFileSync(f,s,'utf8');
console.log('Middleware fixed!');
