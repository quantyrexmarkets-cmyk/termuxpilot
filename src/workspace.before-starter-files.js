const fs = require('fs');
const path = require('path');

const WORKSPACES_DIR = path.join(__dirname, '..', 'workspaces');

// Ensure workspaces dir exists
if (!fs.existsSync(WORKSPACES_DIR)) {
  fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
}

function getPath(userId) {
  const dir = path.join(WORKSPACES_DIR, userId || 'guest');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    // Create a welcome file
    fs.writeFileSync(
      path.join(dir, 'welcome.md'),
      '# Welcome to CodeDeck!\n\nThis is your personal workspace.\n\nStart by creating a new file or running a process.\n',
      'utf8'
    );
  }
  return dir;
}

function getUserStore(userId) {
  const dir = getPath(userId);
  const storeFile = path.join(dir, '.codedeck-processes.json');
  try {
    if (!fs.existsSync(storeFile)) return [];
    return JSON.parse(fs.readFileSync(storeFile, 'utf8') || '[]');
  } catch (e) { return []; }
}

function saveUserStore(userId, data) {
  const dir = getPath(userId);
  const storeFile = path.join(dir, '.codedeck-processes.json');
  try {
    fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function getUserAIHistory(userId) {
  const dir = getPath(userId);
  const file = path.join(dir, '.codedeck-ai-history.json');
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch (e) { return []; }
}

function saveAIHistory(userId, data) {
  const dir = getPath(userId);
  const file = path.join(dir, '.codedeck-ai-history.json');
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

module.exports = { getPath, getUserStore, saveUserStore, getUserAIHistory, saveAIHistory };
