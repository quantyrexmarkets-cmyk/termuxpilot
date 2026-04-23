#!/usr/bin/env node

const isRender = process.env.RENDER || false;

if(!isRender){
  console.log('');
  console.log('  TermuxPilot v2.0.0');
  console.log('  ──────────────────────');
  console.log('');
}

require('./src/server');

if(!isRender){
  setTimeout(() => {
    const { exec } = require('child_process');
    exec('am start -a android.intent.action.VIEW -d http://localhost:3000', (err) => {
      if (err) {
        exec('termux-open-url http://localhost:3000', () => {});
      }
    });
  }, 2000);
}
