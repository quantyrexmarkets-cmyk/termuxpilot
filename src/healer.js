const { exec } = require('child_process');
const path = require('path');

class Healer {
  constructor(pm) {
    this.pm = pm;
    this.history = new Map();
    this.maxRetries = 3;
  }

  async heal(error) {
    const key = error.process + ':' + error.type;
    const attempts = this.history.get(key) || { count: 0, fixes: [] };

    if (attempts.count >= this.maxRetries) {
      return {
        success: false,
        message: 'Max retries reached. Tried ' + attempts.count + ' fixes.',
        attempts: attempts
      };
    }

    let fixCommand = null;
    let fixType = null;

    // Smart action first
    if (error.action) {
      if (error.action.type === 'run_command') {
        fixCommand = error.action.command;
        fixType = 'command';
      } else if (error.action.type === 'create_file') {
        fixCommand = 'touch ' + error.action.path;
        fixType = 'create_file';
      }
    } else if (error.autofix) {
      fixCommand = error.autofix;
      fixType = 'autofix';
    }

    if (!fixCommand) {
      return { success: false, message: 'No auto-fix available' };
    }

    // Check if we already tried this fix
    if (attempts.fixes.includes(fixCommand)) {
      return {
        success: false,
        message: 'Already tried this fix: ' + fixCommand
      };
    }

    // Run the fix
    const result = await this.runFix(fixCommand, error.process);

    // Record attempt
    attempts.count++;
    attempts.fixes.push(fixCommand);
    attempts.lastFix = fixCommand;
    attempts.lastResult = result;
    attempts.time = new Date();
    this.history.set(key, attempts);

    if (result.success) {
      // Restart the process
      const proc = this.pm.getAll().find(p => p.name === error.process);
      if (proc) {
        setTimeout(() => {
          this.pm.restart(error.process);
        }, 1000);
      }
    }

    return {
      success: result.success,
      message: result.success
        ? 'Fix applied! Restarting...'
        : 'Fix failed: ' + result.output,
      fix: fixCommand,
      fixType: fixType,
      attempt: attempts.count,
      willRestart: result.success
    };
  }

  runFix(command, processName) {
    return new Promise((resolve) => {
      const proc = this.pm.getAll().find(p => p.name === processName);
      const cwd = proc ? proc.cwd : process.env.HOME;

      exec(command, { cwd: cwd, timeout: 30000 }, (err, stdout, stderr) => {
        resolve({
          success: !err,
          output: stdout || stderr || (err ? err.message : 'Done'),
          command: command
        });
      });
    });
  }

  // Check if error repeats after fix
  checkHealed(processName, errorType) {
    const key = processName + ':' + errorType;
    const attempts = this.history.get(key);
    if (!attempts) return null;
    return attempts;
  }

  // Mark as healed
  markHealed(processName, errorType) {
    const key = processName + ':' + errorType;
    const attempts = this.history.get(key);
    if (attempts) {
      attempts.healed = true;
      attempts.healedAt = new Date();
      this.history.set(key, attempts);
    }
  }

  // Get heal history
  getHistory() {
    const result = [];
    for (const [key, val] of this.history) {
      result.push({ key, ...val });
    }
    return result;
  }

  // Clear history
  clearHistory() {
    this.history.clear();
  }
}

module.exports = Healer;
