const express = require('express');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { exec } = require('child_process');
const pm = require('./processManager');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ═══════════════════════════════════
// API ROUTES
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

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});


// ═══════════════════════════════════
// PROJECT PROFILE ROUTES
// ═══════════════════════════════════
const projects = require('./projects');
const pm2 = require('./processManager');

// Get all projects
app.get('/api/projects', (req, res) => {
  res.json({ projects: projects.getAll() });
});

// Save a project
app.post('/api/projects', (req, res) => {
  const { name, processes } = req.body;
  if (!name || !processes || !processes.length) {
    return res.status(400).json({ message: 'Name and processes required' });
  }
  res.json(projects.add({ name, processes }));
});

// Delete a project
app.delete('/api/projects/:name', (req, res) => {
  res.json(projects.remove(req.params.name));
});

// Start all processes in a project
app.post('/api/projects/:name/start', (req, res) => {
  const project = projects.get(req.params.name);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const results = [];
  project.processes.forEach(proc => {
    const result = pm2.start({
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

// Stop all processes in a project
app.post('/api/projects/:name/stop', (req, res) => {
  const project = projects.get(req.params.name);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const results = [];
  project.processes.forEach(proc => {
    const result = pm2.stop(proc.name);
    results.push({ name: proc.name, ...result });
  });

  res.json({ message: 'Project stopped', results });
});

// Restart all processes in a project
app.post('/api/projects/:name/restart', (req, res) => {
  const project = projects.get(req.params.name);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const results = [];
  project.processes.forEach(proc => {
    const result = pm2.restart(proc.name);
    results.push({ name: proc.name, ...result });
  });

  res.json({ message: 'Project restarted', results });
});

// ═══════════════════════════════════
// GET NETWORK IP
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

// ═══════════════════════════════════
// OPEN BROWSER
// ═══════════════════════════════════
function openBrowser(url) {
  exec(`termux-open-url ${url}`, (err) => {
    if (err) {
      exec(`am start -a android.intent.action.VIEW -d ${url}`, (err2) => {
        if (err2) console.log(`  ⚠️  Could not open browser. Visit: ${url}`);
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
        console.log('  🌐 Opening dashboard...');
        break;

      case 'l':
        const procs = pm.getAll();
        if (!procs.length) {
          console.log('  📋 No processes running');
        } else {
          console.log('\n  📋 Running Processes:');
          procs.forEach(p => {
            const status = p.running ? '🟢' : '🔴';
            console.log(`  ${status} ${p.name} | PID: ${p.pid || '-'} | Uptime: ${p.uptimeFormatted}`);
          });
          console.log('');
        }
        break;

      case 'r':
        console.log('  🔄 Restarting all running processes...');
        pm.getAll().filter(p => p.running).forEach(p => pm.restart(p.name));
        break;

      case 's':
        const sys = pm.getSystemStats();
        console.log(`\n  💻 System Stats:`);
        console.log(`  RAM: ${sys.usedMemory}MB / ${sys.totalMemory}MB (${sys.memoryPercent}%)`);
        console.log(`  Load: ${sys.loadAvg}`);
        console.log(`  Uptime: ${sys.uptimeFormatted}\n`);
        break;

      case 'q':
        console.log('\n  👋 Shutting down TermuxPilot...\n');
        process.exit(0);
        break;

      case 'h':
      case '?':
        printHelp(PORT);
        break;

      default:
        if (key) console.log(`  ❓ Unknown command: "${key}" — type 'h' for help`);
    }
  });
}

function printHelp(PORT) {
  console.log(`
  ┌─────────────────────────────────┐
  │     TermuxPilot Commands        │
  ├─────────────────────────────────┤
  │  o  →  Open dashboard           │
  │  l  →  List all processes       │
  │  r  →  Restart all processes    │
  │  s  →  Show system stats        │
  │  q  →  Quit TermuxPilot         │
  │  h  →  Show this help           │
  └─────────────────────────────────┘
  Dashboard: http://localhost:${PORT}
  `);
}

// ═══════════════════════════════════
// STARTUP
// ═══════════════════════════════════
pm.restore();

const PORT = process.env.PILOT_PORT || 8000;

app.listen(PORT, '0.0.0.0', () => {
  const lanIP = getLanIP();

  console.log(`
  🛩️  TermuxPilot v1.0.0
  ──────────────────────
  🌐 Local:   http://localhost:${PORT}
  📡 Network: http://${lanIP}:${PORT}
  🔧 API:     http://localhost:${PORT}/api/processes

  ┌─────────────────┐
  │  o → Open       │
  │  l → List       │
  │  r → Restart    │
  │  s → Stats      │
  │  q → Quit       │
  │  h → Help       │
  └─────────────────┘
  `);

  // Auto open on first run
  setTimeout(() => openBrowser(`http://localhost:${PORT}`), 1500);

  setupCLI(PORT);
});

module.exports = app;
