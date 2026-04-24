const { spawn } = require('child_process');
const path = require('path');

class Terminal {
  constructor() {
    this.sessions = new Map();
  }

  create(id, cwd) {
    if (this.sessions.has(id)) {
      this.destroy(id);
    }

    const shell = process.env.SHELL || '/data/data/com.termux/files/usr/bin/bash';
    const home = process.env.HOME;
    const resolvedCwd = cwd ? cwd.replace(/^~/, home) : home;

    const proc = spawn(shell, ['-i'], {
      cwd: resolvedCwd,
      env: {
        ...process.env,
        TERM: 'xterm',
        COLUMNS: '80',
        LINES: '24'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const session = {
      id,
      proc,
      output: [],
      maxOutput: 500,
      cwd: resolvedCwd,
      alive: true
    };

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      session.output.push({ type: 'stdout', text, time: new Date() });
      if (session.output.length > session.maxOutput) session.output.shift();
      if (session.onData) session.onData(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      session.output.push({ type: 'stderr', text, time: new Date() });
      if (session.output.length > session.maxOutput) session.output.shift();
      if (session.onData) session.onData(text);
    });

    proc.on('exit', (code) => {
      session.alive = false;
      session.output.push({ type: 'system', text: 'Shell exited with code ' + code, time: new Date() });
    });

    this.sessions.set(id, session);
    return { success: true, id };
  }

  write(id, command) {
    const session = this.sessions.get(id);
    if (!session || !session.alive) return { error: 'No active session' };
    session.proc.stdin.write(command + '\n');
    return { success: true };
  }

  getOutput(id, since) {
    const session = this.sessions.get(id);
    if (!session) return { error: 'No session' };
    let output = session.output;
    if (since) {
      const sinceTime = new Date(since).getTime();
      output = output.filter(o => new Date(o.time).getTime() > sinceTime);
    }
    return { output, alive: session.alive };
  }

  destroy(id) {
    const session = this.sessions.get(id);
    if (!session) return;
    try {
      session.proc.kill('SIGTERM');
    } catch (e) {}
    this.sessions.delete(id);
    return { success: true };
  }

  list() {
    const result = [];
    for (const [id, session] of this.sessions) {
      result.push({ id, alive: session.alive, cwd: session.cwd });
    }
    return result;
  }
}

module.exports = new Terminal();
