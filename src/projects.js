const fs = require('fs');
const path = require('path');

const PROJECTS_FILE = path.join(__dirname, '..', 'projects.json');

const load = () => {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
};

const save = (projects) => {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
  } catch (e) {
    console.error('Projects save error:', e.message);
  }
};

const getAll = () => load();

const get = (name) => load().find(p => p.name === name);

const add = (project) => {
  const projects = load();
  const existing = projects.findIndex(p => p.name === project.name);
  if (existing >= 0) {
    projects[existing] = project;
  } else {
    projects.push(project);
  }
  save(projects);
  return { success: true, message: `Project "${project.name}" saved` };
};

const remove = (name) => {
  const projects = load().filter(p => p.name !== name);
  save(projects);
  return { success: true, message: `Project "${name}" removed` };
};

module.exports = { getAll, get, add, remove, save, load };
