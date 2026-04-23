const { spawn } = require('child_process');
const path = require('path');
const { parse } = require('shell-quote');
const store = require('./store');

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
    this.maxLogLines = 200;
  }

  // ── Save to store (Fix: proper serialization) ──
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

    // Fix: detached + unref for true independence
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
      logBuffer.push({
        time: new Date(),
        type: 'stderr',
        text: `Spawn error: ${err.message}`,
      });
      if (logBuffer.length > this.maxLogLines) logBuffer.shift();
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

        // Fix: Auto port detection from logs
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

        // Also detect port from stderr (Vite logs to stderr)
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

      // Fix: restart race condition - use flag instead of setTimeout
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

      // Auto restart on crash
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

    // Fix: kill entire process group
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

    // Fix: use restarting flag to avoid race condition
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
    // Fix: clear logs on remove to prevent memory leak
    this.logs.delete(name);
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
