#!/usr/bin/env node

console.log('');
console.log('  🛩️  TermuxPilot v1.0.0');
console.log('  ──────────────────────');
console.log('');

// Start the server
require('./src/server');

// Auto-open browser after 2 seconds
setTimeout(() => {
  const { exec } = require('child_process');
  exec('am start -a android.intent.action.VIEW -d http://localhost:8000', (err) => {
    if (err) {
      exec('termux-open-url http://localhost:8000', () => {});
    }
  });
}, 2000);
