const { exec } = require('child_process');
const HOME = process.env.HOME || '/data/data/com.termux/files/home';
const SHELL = process.env.SHELL || '/data/data/com.termux/files/usr/bin/bash';
const path = require('path');

function run(cmd, cwd) {
  return new Promise((resolve) => {
    const resolvedCwd = cwd ? cwd.replace(/^~/, HOME) : HOME;
exec(cmd, { cwd: resolvedCwd, shell: SHELL, env: process.env }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        output: (stdout || stderr || '').trim(),
        error: err ? err.message : null
      });
    });
  });
}

async function status(cwd) {
  return run('git status --short', cwd);
}

async function log(cwd) {
  return run('git log --oneline -10', cwd);
}

async function diff(cwd) {
  return run('git diff --stat', cwd);
}

async function commit(message, cwd) {
  await run('git add -A', cwd);
  return run('git commit -m "' + message + '"', cwd);
}

async function push(cwd) {
  return run('git push origin main', cwd);
}

async function pull(cwd) {
  return run('git pull', cwd);
}

async function branch(name, cwd) {
  if (name) return run('git checkout -b ' + name, cwd);
  return run('git branch', cwd);
}

async function checkout(name, cwd) {
  return run('git checkout ' + name, cwd);
}

async function init(cwd) {
  return run('git init', cwd);
}

async function clone(url, cwd) {
  return run('git clone ' + url, cwd);
}

async function isRepo(cwd) {
  const r = await run('git rev-parse --is-inside-work-tree', cwd);
  return r.success;
}

module.exports = { status, log, diff, commit, push, pull, branch, checkout, init, clone, isRepo, run };
