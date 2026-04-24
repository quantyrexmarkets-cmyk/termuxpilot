const fs = require('fs');
const path = require('path');

const files = [
  'public/index.html',
  'public/landing.html',
  'public/login.html',
  'src/server.js',
  'pilot.js',
  'package.json',
  'render.yaml',
  'README.md'
];

const replacements = [
  [/TermuxPilot/g, 'CodeDeck'],
  [/termuxpilot/g, 'codedeck'],
  [/Termux Pilot/g, 'CodeDeck'],
  [/termux-pilot/g, 'codedeck'],
  [/pilot\.js/g, 'codedeck.js'],
  [/TERMUXPILOT_LOCAL/g, 'CODEDECK_LOCAL'],
  [/PILOT_PORT/g, 'CODEDECK_PORT'],
  [/pilot_token/g, 'codedeck_token'],
  [/pilot_user/g, 'codedeck_user'],
  [/pilot\.log/g, 'codedeck.log'],
];

let count = 0;
files.forEach(f => {
  const full = path.join(__dirname, f);
  if (!fs.existsSync(full)) return;
  let content = fs.readFileSync(full, 'utf8');
  replacements.forEach(([search, replace]) => {
    const matches = content.match(search);
    if (matches) count += matches.length;
    content = content.replace(search, replace);
  });
  fs.writeFileSync(full, content, 'utf8');
});

console.log('Rebranded! ' + count + ' replacements made.');
