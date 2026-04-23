const fs = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, '..', 'processes.json');

const save = (data) => {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Store save error:', e.message);
  }
};

const load = () => {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Store load error:', e.message);
    return [];
  }
};

const clear = () => {
  try {
    fs.writeFileSync(STORE_FILE, '[]', 'utf8');
  } catch (e) {}
};

module.exports = { save, load, clear };
