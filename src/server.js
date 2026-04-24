const express = require('express');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { exec } = require('child_process');
const pm = require('./processManager');
const auth = require('./auth');
const projects = require('./projects');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));


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
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const user = auth.verify(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
  res.json({ user });
});

// ═══════════════════════════════════
// PROCESS API ROUTES
// ═══════════════════════════════════

app.get('/api/processes', (req, res) => {
  res.json({ processes: pm.getAll(), system: pm.getSystemStats() });
});

app.post('/api/processes', (req, res) => {
  const { name, command, cwd, port, autoRestart, env } = req.body;
  if (!name || !command) return res.status(400).json({ message: 'Name and command required' });
  res.json(pm.start({ name, command, cwd, port, autoRestart, env }));
});

app.post('/api/processes/:name/stop', (req, res) => {
  res.json(pm.stop(req.params.name));
});

app.post('/api/processes/:name/restart', (req, res) => {
  res.json(pm.restart(req.params.name));
});

app.delete('/api/processes/:name', (req, res) => {
  res.json(pm.remove(req.params.name));
});

app.get('/api/processes/:name/logs', (req, res) => {
  res.json({ logs: pm.getLogs(req.params.name) });
});

app.delete('/api/processes/:name/logs', (req, res) => {
  res.json(pm.clearLogs(req.params.name));
});

app.get('/api/system', (req, res) => {
  res.json(pm.getSystemStats());
});

app.get('/api/network', (req, res) => {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4') {
        addresses.push({ name, address: net.address, internal: net.internal });
      }
    }
  }
  res.json({ addresses, port: PORT });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ═══════════════════════════════════
// PROJECT PROFILE ROUTES
// ═══════════════════════════════════

app.get('/api/projects', (req, res) => {
  res.json({ projects: projects.getAll() });
});

app.post('/api/projects', (req, res) => {
  const { name, processes } = req.body;
  if (!name || !processes || !processes.length) {
    return res.status(400).json({ message: 'Name and processes required' });
  }
  res.json(projects.add({ name, processes }));
});

app.delete('/api/projects/:name', (req, res) => {
  res.json(projects.remove(req.params.name));
});

app.post('/api/projects/:name/start', (req, res) => {
  const project = projects.get(req.params.name);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const results = [];
  project.processes.forEach(proc => {
    const result = pm.start({
      name: proc.name,
      command: proc.command,
      cwd: proc.cwd,
      port: proc.port,
      autoRestart: proc.autoRestart || false,
    });
    results.push({ name: proc.name, ...result });
  });

  res.json({ message: 'Project started', results });
});

app.post('/api/projects/:name/stop', (req, res) => {
  const project = projects.get(req.params.name);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const results = [];
  project.processes.forEach(proc => {
    const result = pm.stop(proc.name);
    results.push({ name: proc.name, ...result });
  });

  res.json({ message: 'Project stopped', results });
});

app.post('/api/projects/:name/restart', (req, res) => {
  const project = projects.get(req.params.name);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const results = [];
  project.processes.forEach(proc => {
    const result = pm.restart(proc.name);
    results.push({ name: proc.name, ...result });
  });

  res.json({ message: 'Project restarted', results });
});

// ═══════════════════════════════════
// AI BRAIN API ROUTES
// ═══════════════════════════════════

app.get('/api/ai/errors', (req, res) => {
  res.json({ errors: pm.getAllErrors() });
});

app.get('/api/ai/errors/:name', (req, res) => {
  res.json({ errors: pm.getErrors(req.params.name) });
});

app.delete('/api/ai/errors/:name', (req, res) => {
  res.json(pm.clearErrors(req.params.name));
});

app.post('/api/ai/analyze', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'text required' });
  const AIBrain = require('./brain');
  const result = AIBrain.analyze(text, 'manual');
  res.json({ result: result || { detected: false, message: 'No known error pattern found' } });
});


// ═══════════════════════════════════
// FILE MANAGER API
// ═══════════════════════════════════
const fm = require('./fileManager');

app.get('/api/files', (req, res) => {
  const dir = req.query.path || '~';
  res.json(fm.listDir(dir));
});

app.get('/api/files/read', (req, res) => {
  if (!req.query.path) return res.status(400).json({ error: 'path required' });
  res.json(fm.readFile(req.query.path));
});

app.post('/api/files/write', (req, res) => {
  const { path, content } = req.body;
  if (!path) return res.status(400).json({ error: 'path required' });
  res.json(fm.writeFile(path, content));
});

app.post('/api/files/create', (req, res) => {
  const { path, type } = req.body;
  if (!path) return res.status(400).json({ error: 'path required' });
  res.json(type === 'dir' ? fm.createDir(path) : fm.createFile(path));
});

app.delete('/api/files', (req, res) => {
  if (!req.query.path) return res.status(400).json({ error: 'path required' });
  res.json(fm.deleteItem(req.query.path));
});

app.post('/api/files/rename', (req, res) => {
  const { path, newName } = req.body;
  if (!path || !newName) return res.status(400).json({ error: 'path and newName required' });
  res.json(fm.renameItem(path, newName));
});


// Smart Action API
app.post('/api/ai/action', (req, res) => {
  const { type, path: filePath, command } = req.body;
  if (type === 'create_file' && filePath) {
    const fm = require('./fileManager');
    res.json(fm.createFile(filePath));
  } else if (type === 'run_command' && command) {
    const { exec } = require('child_process');
    exec(command, { cwd: process.env.HOME }, (err, stdout, stderr) => {
      res.json({ success: !err, output: stdout || stderr || 'Done' });
    });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});


// ═══════════════════════════════════
// SELF-HEALING + LLM API
// ═══════════════════════════════════
const Healer = require('./healer');
const llm = require('./llm');
const healer = new Healer(pm);

// Heal an error
app.post('/api/ai/heal', async (req, res) => {
  const { error } = req.body;
  if (!error) return res.status(400).json({ message: 'error required' });
  const result = await healer.heal(error);
  res.json(result);
});

// Explain an error with LLM
app.post('/api/ai/explain', async (req, res) => {
  const { error } = req.body;
  if (!error) return res.status(400).json({ message: 'error required' });
  const result = await llm.explain(error);
  res.json(result);
});

// Heal history
app.get('/api/ai/heal/history', (req, res) => {
  res.json({ history: healer.getHistory() });
});

// Check LLM status
app.get('/api/ai/llm/status', (req, res) => {
  res.json({ available: llm.isAvailable(), model: llm.model });
});


// Landing page as homepage
app.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'public', 'landing.html'));
});

// App dashboard
app.get('/app', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'public', 'index.html'));
});

app.use( (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ═══════════════════════════════════
// NETWORK + BROWSER
// ═══════════════════════════════════
function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && net.internal === false) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function openBrowser(url) {
  exec(`termux-open-url ${url}`, (err) => {
    if (err) {
      exec(`am start -a android.intent.action.VIEW -d ${url}`, (err2) => {
        if (err2) console.log(`  Could not open browser. Visit: ${url}`);
      });
    }
  });
}

// ═══════════════════════════════════
// CLI KEYBOARD SHORTCUTS
// ═══════════════════════════════════
function setupCLI(PORT) {
  if (!process.stdin.isTTY) return;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (input) => {
    const key = input.trim().toLowerCase();

    switch (key) {
      case 'o':
        openBrowser(`http://localhost:${PORT}`);
        console.log('  Opening dashboard...');
        break;

      case 'l':
        const procs = pm.getAll();
        if (!procs.length) {
          console.log('  No processes running');
        } else {
          console.log('\n  Running Processes:');
          procs.forEach(p => {
            const status = p.running ? 'RUNNING' : 'STOPPED';
            console.log(`  [${status}] ${p.name} | PID: ${p.pid || '-'} | Uptime: ${p.uptimeFormatted}`);
          });
          console.log('');
        }
        break;

      case 'r':
        console.log('  Restarting all running processes...');
        pm.getAll().filter(p => p.running).forEach(p => pm.restart(p.name));
        break;

      case 's':
        const sys = pm.getSystemStats();
        console.log(`\n  System Stats:`);
        console.log(`  RAM: ${sys.usedMemory}MB / ${sys.totalMemory}MB (${sys.memoryPercent}%)`);
        console.log(`  Load: ${sys.loadAvg}`);
        console.log(`  Uptime: ${sys.uptimeFormatted}\n`);
        break;

      case 'q':
        console.log('\n  Shutting down TermuxPilot...\n');
        process.exit(0);
        break;

      case 'h':
      case '?':
        printHelp(PORT);
        break;

      default:
        if (key) console.log(`  Unknown command: "${key}" - type 'h' for help`);
    }
  });
}

function printHelp(PORT) {
  console.log(`
  TermuxPilot Commands
  --------------------
  o  -  Open dashboard
  l  -  List all processes
  r  -  Restart all processes
  s  -  Show system stats
  q  -  Quit TermuxPilot
  h  -  Show this help
  Dashboard: http://localhost:${PORT}
  `);
}

// ═══════════════════════════════════
// STARTUP
// ═══════════════════════════════════
pm.restore();

const PORT = process.env.PILOT_PORT || 3100;

const server = app.listen(PORT, '0.0.0.0', () => {
  const lanIP = getLanIP();

  console.log(`
  TermuxPilot v1.0.0
  ----------------------
  Local:   http://localhost:${PORT}
  Network: http://${lanIP}:${PORT}
  API:     http://localhost:${PORT}/api/processes

  o - Open    l - List    r - Restart
  s - Stats   q - Quit    h - Help
  `);

  if (process.env.TERMUXPILOT_LOCAL === '1') {
    setTimeout(() => openBrowser(`http://localhost:${PORT}`), 1500);
    setupCLI(PORT);
  }
});

module.exports = app;


server.on('error', (err) => {
  console.error('SERVER_ERROR:', err);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT_EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED_REJECTION:', err);
});

process.on('exit', (code) => {
  console.error('PROCESS_EXIT:', code);
});

// Temporary keepalive for debugging
setInterval(() => {}, 60000);
