const fs = require('fs');
const f = __dirname + '/src/server.js';
let s = fs.readFileSync(f, 'utf8');

// Add terminal require
if (!s.includes("require('./terminal')")) {
  s = s.replace(
    "const pm = require('./processManager');",
    "const pm = require('./processManager');\nconst terminalServer = require('./terminal');"
  );
}

// Attach WebSocket after server starts
s = s.replace(
  "console.log('HTTP server ready');",
  "console.log('HTTP server ready');\n  terminalServer.attachToServer(server);\n  console.log('  Terminal WebSocket ready');"
);

fs.writeFileSync(f, s, 'utf8');
console.log('WebSocket terminal attached!');
