const { spawn } = require('child_process');
const path = require('path');
const { parse } = require('shell-quote');
const store = require('./store');
const AIBrain = require('./brain');

const TERMUX_BIN = '/data/data/com.termux/files/usr/bin';

const commandMap = {
  node: TERMUX_BIN + '/node',
  npm: TERMUX_BIN + '/npm',
  npx: TERMUX_BIN + '/npx',
  bash: TERMUX_BIN + '/bash',
  sh: TERMUX_BIN + '/sh',
  python: TERMUX_BIN + '/python',
  python3: TERMUX_BIN + '/python3',
};

class ProcessManager {
  constructor() {
    this.processes = new Map();
    this.logs = new Map();
    this.errors = new Map(); // 🧠 AI detected errors per process
    this.maxLogLines = 200;
    this.maxErrors = 50;
    this._listeners = new Set(); // WebSocket broadcast listeners
  }

  // ── Register broadcast listener ──
  onError(fn) {
    this._listeners.add(fn);
  }

  // ── Broadcast AI error to all listeners ──
  _broadcast(event) {
    this._listeners.forEach(fn => {
      try { fn(event); } catch(e) {}
    });
  }

  // ── Save to store ──
  _save() {
    const serializable = Array.from(this.processes.values()).map(p => ({
      name: p.name,
      command: p.command,
      cwd: p.cwd,
      port: p.port,
      autoRestart: p.autoRestart,
      env: p.env || {},
    }));
    store.save(serializable);
  }

  // ── 🧠 AI Brain scan a log line ──
  _scanLine(line, name, type) {
    // Only scan stderr and stdout for errors
    if (type === 'system') return;

    const result = AIBrain.analyze(line, name);
    if (!result) return;

    // Store the error
    if (!this.errors.has(name)) {
      this.errors.set(name, []);
    }
    const errorList = this.errors.get(name);
    errorList.unshift(result); // newest first
    if (errorList.length > this.maxErrors) errorList.pop();

    // Add to log buffer
    const logBuffer = this.logs.get(name) || [];
    logBuffer.push({
      time: new Date(),
      type: 'ai',
      text: `🧠 AI: ${result.type} detected — ${result.cause}`
    });

    // Broadcast to dashboard
    this._broadcast({
      type: 'AI_ERROR',
      process: name,
      error: result
    });

    console.log(`  🧠 AI Brain [${name}]: ${result.severityEmoji ? result.severityEmoji(result.severity) : '⚠️'} ${result.type} — ${result.cause}`);
  }

  start(config) {
    const { name, command, cwd, port, env = {} } = config;

    if (this.processes.has(name)) {
      const existing = this.processes.get(name);
      if (existing.running) {
        return { success: false, message: `${name} is already running` };
      }
    }

    const resolvedCwd = cwd
      ? path.resolve(cwd.replace(/^~(?=\/|$)/, process.env.HOME))
      : process.cwd();

    const parts = parse(command)
      .filter(Boolean)
      .map(p => (typeof p === 'object' && p.op ? '' : String(p)))
      .filter(Boolean);

    if (!parts.length) {
      return { success: false, message: 'Invalid command' };
    }

    let cmd = parts[0];
    const args = parts.slice(1);
    if (commandMap[cmd]) cmd = commandMap[cmd];

    const logBuffer = [];
    this.logs.set(name, logBuffer);

    const proc = spawn(cmd, args, {
      cwd: resolvedCwd,
      env: {
        ...process.env,
        ...env,
        FORCE_COLOR: '1',
        PATH: process.env.PATH,
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.unref();

    proc.on('error', (err) => {
      const text = `Spawn error: ${err.message}`;
      logBuffer.push({ time: new Date(), type: 'stderr', text });
      if (logBuffer.length > this.maxLogLines) logBuffer.shift();

      // 🧠 Scan for AI error
      this._scanLine(text, name, 'stderr');

      const entry = this.processes.get(name);
      if (entry) {
        entry.running = false;
        entry.exitCode = null;
        entry.exitSignal = 'ERROR';
        entry.stoppedAt = new Date();
      }
    });

    proc.stdout.on('data', (data) => {
      data.toString().split('\n').forEach(line => {
        const clean = line.trim();
        if (!clean) return;
        logBuffer.push({ time: new Date(), type: 'stdout', text: clean });
        if (logBuffer.length > this.maxLogLines) logBuffer.shift();

        // 🧠 Scan stdout for errors too
        this._scanLine(clean, name, 'stdout');

        // Auto port detection
        const match = clean.match(/localhost:(\d{2,5})/);
        if (match) {
          const detectedPort = parseInt(match[1]);
          const entry = this.processes.get(name);
          if (entry && !entry.port) {
            entry.port = detectedPort;
            logBuffer.push({
              time: new Date(),
              type: 'system',
              text: `Auto-detected port: ${detectedPort}`,
            });
            this._save();
          }
        }
      });
    });

    proc.stderr.on('data', (data) => {
      data.toString().split('\n').forEach(line => {
        const clean = line.trim();
        if (!clean) return;
        logBuffer.push({ time: new Date(), type: 'stderr', text: clean });
        if (logBuffer.length > this.maxLogLines) logBuffer.shift();

        // 🧠 Scan stderr for errors
        this._scanLine(clean, name, 'stderr');

        // Also detect port from stderr
        const match = clean.match(/localhost:(\d{2,5})/);
        if (match) {
          const detectedPort = parseInt(match[1]);
          const entry = this.processes.get(name);
          if (entry && !entry.port) {
            entry.port = detectedPort;
            logBuffer.push({
              time: new Date(),
              type: 'system',
              text: `Auto-detected port: ${detectedPort}`,
            });
            this._save();
          }
        }
      });
    });

    proc.on('exit', (code, signal) => {
      const entry = this.processes.get(name);
      if (!entry) return;

      entry.running = false;
      entry.exitCode = code;
      entry.exitSignal = signal;
      entry.stoppedAt = new Date();

      logBuffer.push({
        time: new Date(),
        type: 'system',
        text: `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`,
      });
      if (logBuffer.length > this.maxLogLines) logBuffer.shift();

      if (entry.restarting) {
        entry.restarting = false;
        setTimeout(() => {
          this.start({
            name: entry.name,
            command: entry.command,
            cwd: entry.cwd,
            port: entry.port,
            autoRestart: entry.autoRestart,
            env: entry.env,
          });
        }, 500);
        return;
      }

      if (entry.autoRestart && code !== 0 && code !== null) {
        logBuffer.push({
          time: new Date(),
          type: 'system',
          text: 'Auto-restarting in 3 seconds...',
        });
        if (logBuffer.length > this.maxLogLines) logBuffer.shift();

        setTimeout(() => {
          const current = this.processes.get(name);
          if (current && !current.running) {
            this.start({
              name: current.name,
              command: current.command,
              cwd: current.cwd,
              port: current.port,
              autoRestart: current.autoRestart,
              env: current.env,
            });
          }
        }, 3000);
      }
    });

    this.processes.set(name, {
      name,
      command,
      cwd: resolvedCwd,
      port: port || null,
      pid: proc.pid,
      process: proc,
      running: true,
      autoRestart: config.autoRestart || false,
      restarting: false,
      env: env || {},
      startedAt: new Date(),
      stoppedAt: null,
      exitCode: null,
      exitSignal: null,
    });

    this._save();
    return { success: true, message: `${name} started`, pid: proc.pid };
  }

  stop(name) {
    const entry = this.processes.get(name);
    if (!entry) return { success: false, message: `${name} not found` };
    if (!entry.running) return { success: false, message: `${name} is not running` };

    entry.autoRestart = false;
    entry.restarting = false;

    try {
      process.kill(-entry.pid, 'SIGTERM');
    } catch (e) {
      try { entry.process.kill('SIGTERM'); } catch (e2) {}
    }

    entry.running = false;
    entry.stoppedAt = new Date();

    const logs = this.logs.get(name) || [];
    logs.push({ time: new Date(), type: 'system', text: 'Process stopped by user' });

    this._save();
    return { success: true, message: `${name} stopped` };
  }

  restart(name) {
    const entry = this.processes.get(name);
    if (!entry) return { success: false, message: `${name} not found` };

    entry.restarting = true;

    try {
      process.kill(-entry.pid, 'SIGTERM');
    } catch (e) {
      try { entry.process.kill('SIGTERM'); } catch (e2) {}
    }

    return { success: true, message: `${name} restarting...` };
  }

  remove(name) {
    const entry = this.processes.get(name);
    if (entry && entry.running) this.stop(name);
    this.processes.delete(name);
    this.logs.delete(name);
    this.errors.delete(name); // 🧠 Clean up AI errors too
    this._save();
    return { success: true, message: `${name} removed` };
  }

  restore() {
    const saved = store.load();
    if (!saved.length) return;
    console.log(`  📦 Restoring ${saved.length} saved process(es)...`);
    saved.forEach(config => {
      try {
        const result = this.start(config);
        if (result.success) {
          console.log(`  ✅ Restored: ${config.name}`);
        } else {
          console.log(`  ⚠️  ${config.name}: ${result.message}`);
        }
      } catch (e) {
        console.log(`  ❌ Failed to restore: ${config.name} — ${e.message}`);
      }
    });
  }

  getAll() {
    const result = [];
    for (const [, entry] of this.processes) {
      const uptime = entry.running
        ? Math.floor((Date.now() - entry.startedAt.getTime()) / 1000)
        : 0;
      result.push({
        name: entry.name,
        command: entry.command,
        cwd: entry.cwd,
        port: entry.port,
        pid: entry.pid,
        running: entry.running,
        autoRestart: entry.autoRestart,
        startedAt: entry.startedAt,
        stoppedAt: entry.stoppedAt,
        exitCode: entry.exitCode,
        exitSignal: entry.exitSignal,
        uptime,
        uptimeFormatted: this.formatUptime(uptime),
      });
    }
    return result;
  }

  getLogs(name) {
    return this.logs.get(name) || [];
  }

  // 🧠 Get AI errors for a process
  getErrors(name) {
    return this.errors.get(name) || [];
  }

  // 🧠 Get ALL AI errors across all processes
  getAllErrors() {
    const all = [];
    for (const [name, errors] of this.errors) {
      errors.forEach(e => all.push({ ...e, process: name }));
    }
    // Sort newest first
    return all.sort((a, b) => new Date(b.time) - new Date(a.time));
  }

  // 🧠 Clear AI errors for a process
  clearErrors(name) {
    this.errors.set(name, []);
    return { success: true };
  }

  clearLogs(name) {
    this.logs.set(name, []);
    return { success: true };
  }

  formatUptime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }

  getSystemStats() {
    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      cpuCount: cpus.length || 1,
      cpuModel: cpus[0]?.model || 'ARM Processor',
      loadAvg: loadAvg[0].toFixed(2),
      totalMemory: Math.round(totalMem / 1024 / 1024),
      usedMemory: Math.round(usedMem / 1024 / 1024),
      freeMemory: Math.round(freeMem / 1024 / 1024),
      memoryPercent: Math.round((usedMem / totalMem) * 100),
      platform: os.platform(),
      uptime: Math.floor(os.uptime()),
      uptimeFormatted: this.formatUptime(Math.floor(os.uptime())),
    };
  }
}

module.exports = new ProcessManager();
