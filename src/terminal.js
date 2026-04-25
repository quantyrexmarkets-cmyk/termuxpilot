const { spawn } = require('child_process');
const fs = require('fs');

class Terminal {
  constructor() {
    this.sessions = new Map();
  }

  resolveCwd(cwd) {
    const home = process.env.HOME || '/data/data/com.termux/files/home';
    const resolved = (cwd || '~').replace(/^~/, home);
    try {
      if (fs.existsSync(resolved)) return resolved;
    } catch (e) {}
    return home;
  }

  resolveShell() {
    const candidates = [
      process.env.SHELL,
      '/data/data/com.termux/files/usr/bin/bash',
      '/data/data/com.termux/files/usr/bin/sh',
      'bash',
      'sh'
    ].filter(Boolean);

    for (const shell of candidates) {
      try {
        if (shell === 'bash' || shell === 'sh') return shell;
        if (fs.existsSync(shell)) return shell;
      } catch (e) {}
    }

    return 'sh';
  }

  create(id, cwd) {
    const shell = this.resolveShell();
    const resolvedCwd = this.resolveCwd(cwd);

    try {
      const proc = spawn(shell, [], {
        cwd: resolvedCwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          PS1: ''
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const session = {
        id,
        proc,
        cwd: resolvedCwd,
        alive: true,
        output: [],
        maxOutput: 500
      };

      proc.stdout.on('data', (d) => {
        const text = d.toString();
        session.output.push({ type: 'stdout', text, time: new Date() });
        if (session.output.length > session.maxOutput) session.output.shift();
      });

      proc.stderr.on('data', (d) => {
        const text = d.toString();
        session.output.push({ type: 'stderr', text, time: new Date() });
        if (session.output.length > session.maxOutput) session.output.shift();
      });

      proc.on('error', (err) => {
        session.alive = false;
        session.output.push({
          type: 'stderr',
          text: 'Spawn error: ' + err.message,
          time: new Date()
        });
      });

      proc.on('exit', (code) => {
        session.alive = false;
        session.output.push({
          type: 'system',
          text: 'Shell exited with code ' + code,
          time: new Date()
        });
      });

      this.sessions.set(id, session);

      return {
        success: true,
        id,
        cwd: resolvedCwd,
        shell
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  }

  write(id, command) {
    const session = this.sessions.get(id);
    if (!session || !session.alive) return { error: 'No active session' };

    try {
      session.proc.stdin.write(command + '\n');
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  getOutput(id, since) {
    const session = this.sessions.get(id);
    if (!session) return { error: 'No session' };

    const output = [...session.output];
    session.output = [];

    return {
      success: true,
      alive: session.alive,
      cwd: session.cwd,
      output
    };
  }

  destroy(id) {
    const session = this.sessions.get(id);
    if (!session) return { success: true };

    try {
      session.proc.kill('SIGTERM');
    } catch (e) {}

    this.sessions.delete(id);
    return { success: true };
  }

  list() {
    const out = [];
    for (const [id, s] of this.sessions) {
      out.push({
        id,
        cwd: s.cwd,
        alive: s.alive
      });
    }
    return out;
  }

  // no-op for now, so server code won't break
  attachToServer() {
    return;
  }
}

module.exports = new Terminal();
