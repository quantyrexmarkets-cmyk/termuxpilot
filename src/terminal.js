const { spawn } = require('child_process');
const WebSocket = require('ws');

class TerminalServer {
  constructor() {
    this.sessions = new Map();
  }

  attachToServer(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws/terminal' });

    this.wss.on('connection', (ws) => {
      let session = null;

      ws.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);

          if (data.type === 'create') {
            session = this.create(data.cwd);
            ws.send(JSON.stringify({ type: 'created', id: session.id }));

            session.proc.stdout.on('data', (d) => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'output', text: d.toString() }));
              }
            });

            session.proc.stderr.on('data', (d) => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'error', text: d.toString() }));
              }
            });

            session.proc.on('exit', (code) => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'exit', code }));
              }
            });
          }

          if (data.type === 'input' && session && session.alive) {
            session.proc.stdin.write(data.text);
          }

          if (data.type === 'resize' && session) {
            // Handle resize if needed
          }

        } catch (e) {}
      });

      ws.on('close', () => {
        if (session) {
          this.destroy(session.id);
        }
      });
    });
  }

  create(cwd) {
    const shell = process.env.SHELL || '/data/data/com.termux/files/usr/bin/bash';
    const home = process.env.HOME;
    const resolvedCwd = cwd ? cwd.replace(/^~/, home) : home;
    const id = 'term_' + Date.now();

    const proc = spawn(shell, ['-i'], {
      cwd: resolvedCwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLUMNS: '80',
        LINES: '24'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const session = { id, proc, alive: true, cwd: resolvedCwd };

    proc.on('exit', () => {
      session.alive = false;
    });

    this.sessions.set(id, session);
    return session;
  }

  destroy(id) {
    const session = this.sessions.get(id);
    if (!session) return;
    try { session.proc.kill('SIGTERM'); } catch (e) {}
    this.sessions.delete(id);
  }
}

module.exports = new TerminalServer();
