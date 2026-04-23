const AIBrain = {

  // Strip ANSI color codes before matching
  strip(text) {
    return text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\x1b\[[0-9;]*m/g, '');
  },

  knowledge: [
    {
      pattern: /cannot find module/i,
      type: 'MODULE_NOT_FOUND',
      severity: 'critical',
      cause: 'Missing Node.js package or wrong import path',
      fixes: ['Run: npm install','Run: npm install <module-name>','Check your import/require path is correct'],
      autofix: 'npm install'
    },
    {
      pattern: /eaddrinuse|address already in use/i,
      type: 'PORT_IN_USE',
      severity: 'high',
      cause: 'Port is already being used by another process',
      fixes: ['Change the port in your config','Run: pkill -f node','Restart TermuxPilot'],
      autofix: null
    },
    {
      pattern: /syntaxerror/i,
      type: 'SYNTAX_ERROR',
      severity: 'critical',
      cause: 'Bad code syntax - missing bracket, comma or semicolon',
      fixes: ['Check for missing } ) ] brackets','Look for missing commas in objects/arrays','Check the line number shown in error'],
      autofix: null
    },
    {
      pattern: /typeerror/i,
      type: 'TYPE_ERROR',
      severity: 'high',
      cause: 'Wrong data type - variable may be null or undefined',
      fixes: ['Check variable is not null or undefined','Add a null check before using the variable','Verify function returns the correct type'],
      autofix: null
    },
    {
      pattern: /referenceerror/i,
      type: 'REFERENCE_ERROR',
      severity: 'high',
      cause: 'Variable or function used before it was defined',
      fixes: ['Check variable is declared before use','Check for typos in variable name','Make sure import/require is at top of file'],
      autofix: null
    },
    {
      pattern: /econnrefused/i,
      type: 'CONNECTION_REFUSED',
      severity: 'high',
      cause: 'Connection refused - target service is not running',
      fixes: ['Start your database or server first','Check if the service is running','Verify the host and port are correct'],
      autofix: null
    },
    {
      pattern: /enoent|no such file or directory/i,
      type: 'FILE_NOT_FOUND',
      severity: 'high',
      cause: 'File or directory does not exist',
      fixes: ['Check the file path is correct','Make sure the file exists','Check for typos in the filename'],
      autofix: null
    },
    {
      pattern: /eacces|permission denied/i,
      type: 'PERMISSION_DENIED',
      severity: 'medium',
      cause: 'No permission to access file or port',
      fixes: ['Run: chmod +x <filename>','Check file permissions','Use a port number above 1024'],
      autofix: null
    },
    {
      pattern: /enomem|out of memory/i,
      type: 'OUT_OF_MEMORY',
      severity: 'critical',
      cause: 'System ran out of memory',
      fixes: ['Restart the process','Close other apps to free memory','Reduce memory usage in your code'],
      autofix: null
    },
    {
      pattern: /etimedout|timed out/i,
      type: 'TIMEOUT',
      severity: 'medium',
      cause: 'Connection or operation timed out',
      fixes: ['Check your internet connection','Increase timeout value in config','Check if remote server is reachable'],
      autofix: null
    },
    {
      pattern: /modulenotfounderror|no module named/i,
      type: 'PYTHON_MODULE_MISSING',
      severity: 'critical',
      cause: 'Python module is not installed',
      fixes: ['Run: pip install <module-name>','Run: pip3 install <module-name>','Check your Python environment'],
      autofix: 'pip install'
    },
    {
      pattern: /indentationerror/i,
      type: 'PYTHON_INDENT',
      severity: 'critical',
      cause: 'Wrong indentation in Python code',
      fixes: ['Use consistent spaces (4 spaces recommended)','Do not mix tabs and spaces','Check the line number in the error'],
      autofix: null
    },
    {
      pattern: /nameerror/i,
      type: 'PYTHON_NAME_ERROR',
      severity: 'high',
      cause: 'Variable or function name not defined in Python',
      fixes: ['Check variable is defined before use','Check for typos in the variable name','Make sure you imported the module'],
      autofix: null
    },
    {
      pattern: /segmentation fault/i,
      type: 'SEGFAULT',
      severity: 'critical',
      cause: 'Program crashed with segmentation fault',
      fixes: ['Restart the process','Check for memory issues in native code','Update or reinstall the package'],
      autofix: null
    },
    {
      pattern: /killed|sigkill/i,
      type: 'PROCESS_KILLED',
      severity: 'high',
      cause: 'Process was killed by the system',
      fixes: ['Restart the process','Close other apps to free memory','Reduce memory usage'],
      autofix: null
    },
    {
      pattern: /unhandledpromiserejection|unhandled promise/i,
      type: 'UNHANDLED_PROMISE',
      severity: 'high',
      cause: 'A Promise error was not caught in your code',
      fixes: ['Add .catch() to your Promise','Use try/catch with async/await','Handle all promise rejections'],
      autofix: null
    },
    {
      pattern: /heap out of memory|javascript heap/i,
      type: 'HEAP_OOM',
      severity: 'critical',
      cause: 'Node.js ran out of heap memory',
      fixes: ['Run: node --max-old-space-size=512 your-file.js','Check for memory leaks in your code','Reduce data loaded into memory'],
      autofix: null
    },
    {
      pattern: /network error|net::err/i,
      type: 'NETWORK_ERROR',
      severity: 'medium',
      cause: 'Network request failed',
      fixes: ['Check your internet connection','Verify the URL is correct','Check if the server is online'],
      autofix: null
    }
  ],

  analyze(line, processName) {
    const text = this.strip(line).trim();
    if (!text) return null;
    for (const rule of this.knowledge) {
      if (rule.pattern.test(text)) {
        return {
          detected: true,
          process: processName,
          type: rule.type,
          severity: rule.severity,
          cause: rule.cause,
          fixes: rule.fixes,
          autofix: rule.autofix,
          canAutoFix: rule.autofix !== null,
          rawError: text,
          time: new Date()
        };
      }
    }
    return null;
  }
};

module.exports = AIBrain;
