const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const oldIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 014 4c0 1.95-1.4 3.57-3.25 3.92L12 14"/><circle cx="12" cy="19" r="2"/><path d="M5 8a7 7 0 0114 0"/><path d="M2 12a10 10 0 0120 0"/></svg>';

const newIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="14" rx="3"/><line x1="12" y1="2" x2="12" y2="6"/><circle cx="12" cy="2" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><path d="M9 16h6"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></svg>';

let count = 0;
while (html.includes(oldIcon)) {
  html = html.replace(oldIcon, newIcon);
  count++;
}

fs.writeFileSync(file, html, 'utf8');
console.log('Replaced ' + count + ' AI icons with robot head!');
