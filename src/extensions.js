const fs = require('fs');
const path = require('path');

const EXT_DIR = path.join(__dirname, '..', 'extensions');
if (!fs.existsSync(EXT_DIR)) fs.mkdirSync(EXT_DIR, { recursive: true });

// Built-in extensions
const builtins = [
  {
    id: 'node-runner',
    name: 'Node.js Runner',
    icon: 'N',
    color: '#68a063',
    desc: 'Run and debug Node.js applications',
    commands: {
      'run': 'node index.js',
      'start': 'npm start',
      'dev': 'npm run dev',
      'test': 'npm test',
      'install': 'npm install',
      'init': 'npm init -y'
    },
    detect: ['package.json', 'node_modules'],
    active: true
  },
  {
    id: 'python-runner',
    name: 'Python Runner',
    icon: 'Py',
    color: '#3776ab',
    desc: 'Run Python scripts and manage packages',
    commands: {
      'pyrun': 'python3 main.py',
      'pip': 'pip install',
      'venv': 'python3 -m venv venv',
      'activate': 'source venv/bin/activate'
    },
    detect: ['requirements.txt', 'main.py', 'app.py'],
    active: true
  },
  {
    id: 'git-tools',
    name: 'Git Tools',
    icon: 'G',
    color: '#f05032',
    desc: 'Git commands and shortcuts',
    commands: {
      'status': 'git status',
      'commit': 'git add -A && git commit -m',
      'push': 'git push origin main',
      'pull': 'git pull',
      'log': 'git log --oneline -10',
      'diff': 'git diff',
      'branch': 'git branch'
    },
    detect: ['.git'],
    active: true
  },
  {
    id: 'docker-tools',
    name: 'Docker Tools',
    icon: 'D',
    color: '#2496ed',
    desc: 'Docker container management',
    commands: {
      'dps': 'docker ps',
      'dup': 'docker compose up -d',
      'ddown': 'docker compose down',
      'dlogs': 'docker compose logs -f',
      'dbuild': 'docker build -t app .'
    },
    detect: ['Dockerfile', 'docker-compose.yml'],
    active: true
  },
  {
    id: 'react-tools',
    name: 'React Tools',
    icon: 'R',
    color: '#61dafb',
    desc: 'React development shortcuts',
    commands: {
      'create-react': 'npx create-react-app my-app',
      'next': 'npx create-next-app@latest',
      'vite': 'npm create vite@latest'
    },
    detect: ['src/App.js', 'src/App.tsx'],
    active: true
  },
  {
    id: 'db-tools',
    name: 'Database Tools',
    icon: 'DB',
    color: '#47a248',
    desc: 'Database management shortcuts',
    commands: {
      'mongo': 'mongosh',
      'redis': 'redis-cli',
      'sqlite': 'sqlite3'
    },
    detect: [],
    active: true
  }
];

function getAll() {
  // Load custom extensions
  const custom = [];
  try {
    const files = fs.readdirSync(EXT_DIR);
    files.forEach(f => {
      if (f.endsWith('.json')) {
        try {
          const ext = JSON.parse(fs.readFileSync(path.join(EXT_DIR, f), 'utf8'));
          custom.push(ext);
        } catch (e) {}
      }
    });
  } catch (e) {}
  return [...builtins, ...custom];
}

function getCommands() {
  const all = getAll();
  const cmds = {};
  all.forEach(ext => {
    if (!ext.active) return;
    Object.entries(ext.commands || {}).forEach(([key, val]) => {
      cmds[key] = { command: val, extension: ext.name };
    });
  });
  return cmds;
}

function install(ext) {
  const file = path.join(EXT_DIR, ext.id + '.json');
  fs.writeFileSync(file, JSON.stringify(ext, null, 2), 'utf8');
  return { success: true };
}

function remove(id) {
  const file = path.join(EXT_DIR, id + '.json');
  try { fs.unlinkSync(file); } catch (e) {}
  return { success: true };
}

module.exports = { getAll, getCommands, install, remove };
