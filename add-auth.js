const fs=require('fs');
const f=__dirname+'/src/server.js';
let s=fs.readFileSync(f,'utf8');

// Add auth require at top
if(!s.includes("require('./auth')")){
  s=s.replace("const pm = require('./processManager');","const pm = require('./processManager');\nconst auth = require('./auth');");
}

// Add auth middleware after app.use(express.json())
if(!s.includes('auth.middleware')){
  s=s.replace('app.use(express.json());','app.use(express.json());\napp.use(auth.middleware);');
}

// Add auth routes before process routes
const authRoutes=`
// ═══════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  const result = await auth.register(email, password, name);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await auth.login(email, password);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user });
});

`;

if(!s.includes('api/auth/register')){
  s=s.replace('// ═══════════════════════════════════\n// PROCESS API ROUTES',authRoutes+'// ═══════════════════════════════════\n// PROCESS API ROUTES');
}

fs.writeFileSync(f,s,'utf8');
console.log('Auth routes added!');
