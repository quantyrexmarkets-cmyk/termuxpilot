const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME;

function safePath(p) {
  let resolved = p.replace(/^~/, HOME);
  resolved = path.resolve(resolved);
  if (!resolved.startsWith(HOME)) return null;
  return resolved;
}

function listDir(dirPath) {
  const full = safePath(dirPath || '~');
  if (!full) return { error: 'Access denied' };
  try {
    const items = fs.readdirSync(full, { withFileTypes: true });
    const result = items
      .filter(i => !i.name.startsWith('.'))
      .map(i => ({
        name: i.name,
        type: i.isDirectory() ? 'dir' : 'file',
        path: path.join(full, i.name),
        size: i.isFile() ? fs.statSync(path.join(full, i.name)).size : 0,
        ext: i.isFile() ? path.extname(i.name) : ''
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return { path: full, parent: path.dirname(full), items: result };
  } catch (e) {
    return { error: e.message };
  }
}

function readFile(filePath) {
  const full = safePath(filePath);
  if (!full) return { error: 'Access denied' };
  try {
    const stat = fs.statSync(full);
    if (stat.size > 500000) return { error: 'File too large (max 500KB)' };
    const content = fs.readFileSync(full, 'utf8');
    return {
      path: full,
      name: path.basename(full),
      ext: path.extname(full),
      content: content,
      size: stat.size
    };
  } catch (e) {
    return { error: e.message };
  }
}

function writeFile(filePath, content) {
  const full = safePath(filePath);
  if (!full) return { error: 'Access denied' };
  try {
    fs.writeFileSync(full, content, 'utf8');
    return { success: true, message: 'File saved' };
  } catch (e) {
    return { error: e.message };
  }
}

function createFile(filePath) {
  const full = safePath(filePath);
  if (!full) return { error: 'Access denied' };
  try {
    fs.writeFileSync(full, '', 'utf8');
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

function createDir(dirPath) {
  const full = safePath(dirPath);
  if (!full) return { error: 'Access denied' };
  try {
    fs.mkdirSync(full, { recursive: true });
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

function deleteItem(itemPath) {
  const full = safePath(itemPath);
  if (!full) return { error: 'Access denied' };
  if (full === HOME) return { error: 'Cannot delete home' };
  try {
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      fs.rmSync(full, { recursive: true });
    } else {
      fs.unlinkSync(full);
    }
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

function renameItem(oldPath, newName) {
  const full = safePath(oldPath);
  if (!full) return { error: 'Access denied' };
  try {
    const newPath = path.join(path.dirname(full), newName);
    fs.renameSync(full, newPath);
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { listDir, readFile, writeFile, createFile, createDir, deleteItem, renameItem };
