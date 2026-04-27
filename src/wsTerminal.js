const { spawn } = require('child_process');
const WebSocket = require('ws');
const { verify } = require('./auth');

class WSTerminal {
  constructor() {
    this.sessions = new Map();
  }

  attach(server) {
    const wss = new WebSocket.Server({ 
      server,
      path: '/ws/shell'
    });

    wss.on('connection', (ws, req) => {
      // Get token from URL query
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      
      // Verify auth
      const user = verify(token);
      if (!user) {
        ws.send(JSON.stringify({ type: 'error', text: 'Unauthorized' }));
        ws.close();
        return;
      }

      // Create shell for this user
      const session = this.createShell(user.id, ws);
      
      ws.send(JSON.stringify({ 
        type: 'connected',
        user: user.name || user.email
      }));

      ws.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);
          if (data.type === 'input' && session.alive) {
            session.proc.stdin.write(data.text);
          }
          if (data.type === 'resize') {
            // handle resize if needed
          }
        } catch(e) {}
      });

      ws.on('close', () => {
        this.killShell(user.id);
      });

      ws.on('error', () => {
        this.killShell(user.id);
      });
    });

    console.log('  WebSocket terminal ready at /ws/shell');
  }

  createShell(userId, ws) {
    // Kill existing session for this user
    this.killShell(userId);

    const HOME = process.env.HOME || '/data/data/com.termux/files/home';
    const SHELL = process.env.SHELL || '/data/data/com.termux/files/usr/bin/bash';

    const proc = spawn(SHELL, [], {
      cwd: HOME,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        PS1: '\\w $ '
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const session = { proc, alive: true, userId };

    proc.stdout.on('data', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'output',
          text: data.toString()
        }));
      }
    });

    proc.stderr.on('data', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'output',
          text: data.toString()
        }));
      }
    });

    proc.on('exit', (code) => {
      session.alive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'exit',
          code: code
        }));
      }
    });

    proc.on('error', (err) => {
      session.alive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          text: err.message
        }));
      }
    });

    this.sessions.set(userId, session);
    return session;
  }

  killShell(userId) {
    const session = this.sessions.get(userId);
    if (!session) return;
    try { session.proc.kill('SIGTERM'); } catch(e) {}
    session.alive = false;
    this.sessions.delete(userId);
  }
}

module.exports = new WSTerminal();
