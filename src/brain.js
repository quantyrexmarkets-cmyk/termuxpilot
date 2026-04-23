const AIBrain = {

  strip(text) {
    return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\x1b\[[0-9;]*m/g, '');
  },

  knowledge: [
    // ── FILE NOT FOUND (must be ABOVE generic module not found) ──
    {
      pattern: /cannot find module ['"]?(\/[^\s'"]+\.(?:js|ts|mjs|cjs|json))/i,
      type: 'FILE_NOT_FOUND',
      severity: 'critical',
      dynamic: true,
      cause: (match) => 'File not found: ' + match[1],
      fixes: (match) => {
        const f = match[1];
        const dir = f.substring(0, f.lastIndexOf('/'));
        const name = f.substring(f.lastIndexOf('/') + 1);
        return [
          'Check if ' + name + ' exists in ' + dir,
          'Run: ls ' + dir,
          'Verify the filename and path',
          'Create the file: touch ' + f
        ];
      },
      action: (match) => ({ type: 'create_file', path: match[1], label: 'Create ' + match[1].substring(match[1].lastIndexOf('/') + 1) }),
      autofix: null
    },
    // ── MISSING NPM PACKAGE ──
    {
      pattern: /cannot find module ['"]([^./][^'"]*)['"]/i,
      type: 'PACKAGE_NOT_FOUND',
      severity: 'critical',
      dynamic: true,
      cause: (match) => 'NPM package not installed: ' + match[1],
      fixes: (match) => [
        'Run: npm install ' + match[1],
        'Check package name is correct',
        'Verify package.json has this dependency'
      ],
      action: (match) => ({ type: 'run_command', command: 'npm install ' + match[1], label: 'Install ' + match[1] }),
      autofix: (match) => 'npm install ' + match[1]
    },
    // ── PORT IN USE ──
    {
      pattern: /eaddrinuse|address already in use[^\d]*(\d+)?/i,
      type: 'PORT_IN_USE',
      severity: 'high',
      dynamic: true,
      cause: (match) => 'Port ' + (match[1] || '') + ' is already in use',
      fixes: (match) => {
        const port = match[1] || '';
        return [
          'Kill process on port: lsof -i :' + port,
          'Change port in your config',
          'Run: pkill -f node'
        ];
      },
      action: () => ({ type: 'run_command', command: 'pkill -f node', label: 'Kill node processes' }),
      autofix: 'pkill -f node'
    },
    // ── SYNTAX ERROR ──
    {
      pattern: /syntaxerror[:\s]+(.+)/i,
      type: 'SYNTAX_ERROR',
      severity: 'critical',
      dynamic: true,
      cause: (match) => 'Syntax error: ' + match[1],
      fixes: () => [
        'Check for missing brackets } ) ]',
        'Look for missing commas',
        'Check the line number in error'
      ],
      action: null,
      autofix: null
    },
    // ── TYPE ERROR with details ──
    {
      pattern: /typeerror[:\s]+(.+)/i,
      type: 'TYPE_ERROR',
      severity: 'high',
      dynamic: true,
      cause: (match) => match[1],
      fixes: () => [
        'Check variable is not null or undefined',
        'Add null check before using variable',
        'Verify function returns correct type'
      ],
      action: null,
      autofix: null
    },
    // ── REFERENCE ERROR with details ──
    {
      pattern: /referenceerror[:\s]+(\w+) is not defined/i,
      type: 'REFERENCE_ERROR',
      severity: 'high',
      dynamic: true,
      cause: (match) => match[1] + ' is not defined',
      fixes: (match) => [
        'Declare ' + match[1] + ' before using it',
        'Check for typos in: ' + match[1],
        'Add import or require for ' + match[1]
      ],
      action: null,
      autofix: null
    },
    // ── REFERENCE ERROR generic ──
    {
      pattern: /referenceerror/i,
      type: 'REFERENCE_ERROR',
      severity: 'high',
      cause: 'Variable or function used before defined',
      fixes: ['Check variable is declared', 'Check for typos', 'Add import/require'],
      autofix: null
    },
    // ── ENOENT ──
    {
      pattern: /enoent[^\w]*no such file[^\w]*['"]?([^\s'"]+)/i,
      type: 'FILE_NOT_FOUND',
      severity: 'high',
      dynamic: true,
      cause: (match) => 'File not found: ' + match[1],
      fixes: (match) => [
        'Check path: ' + match[1],
        'Make sure the file exists',
        'Create it: touch ' + match[1]
      ],
      action: (match) => ({ type: 'create_file', path: match[1], label: 'Create file' }),
      autofix: null
    },
    // ── ENOENT generic ──
    {
      pattern: /enoent|no such file or directory/i,
      type: 'FILE_NOT_FOUND',
      severity: 'high',
      cause: 'File or directory does not exist',
      fixes: ['Check file path', 'Make sure file exists', 'Check for typos'],
      autofix: null
    },
    // ── ECONNREFUSED ──
    {
      pattern: /econnrefused[^\d]*(\d+)?/i,
      type: 'CONNECTION_REFUSED',
      severity: 'high',
      dynamic: true,
      cause: (match) => 'Connection refused on port ' + (match[1] || ''),
      fixes: () => [
        'Start your database or server first',
        'Check if the service is running',
        'Verify host and port'
      ],
      autofix: null
    },
    // ── PERMISSION DENIED ──
    {
      pattern: /eacces|permission denied[^\w]*['"]?([^\s'"]*)/i,
      type: 'PERMISSION_DENIED',
      severity: 'medium',
      dynamic: true,
      cause: (match) => 'Permission denied' + (match[1] ? ': ' + match[1] : ''),
      fixes: (match) => [
        match[1] ? 'Run: chmod +x ' + match[1] : 'Check file permissions',
        'Use port above 1024',
        'Check file ownership'
      ],
      autofix: null
    },
    // ── OUT OF MEMORY ──
    {
      pattern: /enomem|out of memory|heap out of memory|javascript heap/i,
      type: 'OUT_OF_MEMORY',
      severity: 'critical',
      cause: 'System ran out of memory',
      fixes: ['Restart the process', 'Close other apps', 'Run: node --max-old-space-size=512 app.js'],
      autofix: null
    },
    // ── TIMEOUT ──
    {
      pattern: /etimedout|timed out/i,
      type: 'TIMEOUT',
      severity: 'medium',
      cause: 'Connection or operation timed out',
      fixes: ['Check internet connection', 'Increase timeout value', 'Check if server is reachable'],
      autofix: null
    },
    // ── PYTHON MODULE ──
    {
      pattern: /modulenotfounderror[:\s]+no module named ['"]?(\w+)/i,
      type: 'PYTHON_MODULE_MISSING',
      severity: 'critical',
      dynamic: true,
      cause: (match) => 'Python module not installed: ' + match[1],
      fixes: (match) => [
        'Run: pip install ' + match[1],
        'Run: pip3 install ' + match[1],
        'Check Python environment'
      ],
      action: (match) => ({ type: 'run_command', command: 'pip install ' + match[1], label: 'Install ' + match[1] }),
      autofix: (match) => 'pip install ' + match[1]
    },
    // ── PYTHON MODULE generic ──
    {
      pattern: /no module named/i,
      type: 'PYTHON_MODULE_MISSING',
      severity: 'critical',
      cause: 'Python module is not installed',
      fixes: ['Run: pip install <module>', 'Check Python environment'],
      autofix: null
    },
    // ── PYTHON INDENT ──
    {
      pattern: /indentationerror/i,
      type: 'PYTHON_INDENT',
      severity: 'critical',
      cause: 'Wrong indentation in Python code',
      fixes: ['Use 4 spaces consistently', 'Do not mix tabs and spaces', 'Check line number'],
      autofix: null
    },
    // ── PYTHON NAME ERROR ──
    {
      pattern: /nameerror[:\s]+name ['"]?(\w+)/i,
      type: 'PYTHON_NAME_ERROR',
      severity: 'high',
      dynamic: true,
      cause: (match) => match[1] + ' is not defined',
      fixes: (match) => [
        'Define ' + match[1] + ' before using it',
        'Check for typos in: ' + match[1],
        'Import the module'
      ],
      autofix: null
    },
    // ── SEGFAULT ──
    {
      pattern: /segmentation fault/i,
      type: 'SEGFAULT',
      severity: 'critical',
      cause: 'Program crashed - segmentation fault',
      fixes: ['Restart process', 'Update packages', 'Check native code'],
      autofix: null
    },
    // ── KILLED ──
    {
      pattern: /killed|sigkill/i,
      type: 'PROCESS_KILLED',
      severity: 'high',
      cause: 'Process killed by system (likely out of memory)',
      fixes: ['Restart process', 'Free memory', 'Reduce memory usage'],
      autofix: null
    },
    // ── UNHANDLED PROMISE ──
    {
      pattern: /unhandledpromiserejection|unhandled promise/i,
      type: 'UNHANDLED_PROMISE',
      severity: 'high',
      cause: 'Promise error not caught',
      fixes: ['Add .catch() to Promise', 'Use try/catch with async/await'],
      autofix: null
    },
    // ── NETWORK ERROR ──
    {
      pattern: /network error|net::err/i,
      type: 'NETWORK_ERROR',
      severity: 'medium',
      cause: 'Network request failed',
      fixes: ['Check internet connection', 'Verify URL', 'Check if server is online'],
      autofix: null
    }
  ],

  analyze(line, processName) {
    const text = this.strip(line).trim();
    if (!text) return null;

    for (const rule of this.knowledge) {
      const match = text.match(rule.pattern);
      if (match) {
        const isDynamic = rule.dynamic;
        const cause = isDynamic && typeof rule.cause === 'function' ? rule.cause(match) : rule.cause;
        const fixes = isDynamic && typeof rule.fixes === 'function' ? rule.fixes(match) : rule.fixes;
        const autofix = isDynamic && typeof rule.autofix === 'function' ? rule.autofix(match) : rule.autofix;
        const action = isDynamic && typeof rule.action === 'function' ? rule.action(match) : rule.action;

        return {
          detected: true,
          process: processName,
          type: rule.type,
          severity: rule.severity,
          cause: cause,
          fixes: fixes,
          autofix: autofix,
          canAutoFix: autofix !== null,
          action: action || null,
          rawError: text,
          time: new Date()
        };
      }
    }
    return null;
  }
};

module.exports = AIBrain;
