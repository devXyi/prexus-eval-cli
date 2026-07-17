'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function defaultRoot() {
  return process.env.PREXUS_EVAL_HOME || path.join(os.homedir(), '.prexus-eval');
}

class Workspace {
  constructor(root) {
    this.root = root || defaultRoot();
    this.dirs = {
      datasets: path.join(this.root, 'datasets'),
      prompts: path.join(this.root, 'prompts'),
      runs: path.join(this.root, 'runs'),
      reports: path.join(this.root, 'reports'),
      cache: path.join(this.root, 'cache'),
    };
    this.configPath = path.join(this.root, 'config.json');
  }

  exists() {
    return fs.existsSync(this.configPath);
  }

  init() {
    fs.mkdirSync(this.root, { recursive: true });
    Object.keys(this.dirs).forEach((k) => fs.mkdirSync(this.dirs[k], { recursive: true }));
    if (!fs.existsSync(this.configPath)) {
      this.writeConfig({
        version: 1,
        activeTestset: null,
        activeProviderId: null,
        judgeProviderId: null,
        providers: [], // metadata only — id, type, model, endpoint — secrets live in the OS keychain, never here
      });
    }
  }

  readConfig() {
    if (!fs.existsSync(this.configPath)) return null;
    try { return JSON.parse(fs.readFileSync(this.configPath, 'utf8')); } catch (e) { return null; }
  }

  writeConfig(cfg) {
    fs.writeFileSync(this.configPath, JSON.stringify(cfg, null, 2), 'utf8');
  }

  updateConfig(patch) {
    const next = Object.assign({}, this.readConfig() || {}, patch);
    this.writeConfig(next);
    return next;
  }

  // ---- datasets (test sets) — one JSON file per set, easy to diff/review in git ----
  listDatasetNames() {
    if (!fs.existsSync(this.dirs.datasets)) return [];
    return fs.readdirSync(this.dirs.datasets).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  }

  readDataset(name) {
    const p = path.join(this.dirs.datasets, name + '.json');
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  }

  writeDataset(name, data) {
    fs.writeFileSync(path.join(this.dirs.datasets, name + '.json'), JSON.stringify(data, null, 2), 'utf8');
  }

  deleteDataset(name) {
    const p = path.join(this.dirs.datasets, name + '.json');
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // ---- prompts — named, versionable text files ----
  listPromptNames() {
    if (!fs.existsSync(this.dirs.prompts)) return [];
    return fs.readdirSync(this.dirs.prompts).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4)).sort();
  }

  readPrompt(name) {
    const p = path.join(this.dirs.prompts, name + '.txt');
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf8');
  }

  writePrompt(name, text) {
    fs.writeFileSync(path.join(this.dirs.prompts, name + '.txt'), text, 'utf8');
  }

  // ---- runs — one JSON file per run ----
  listRunIds() {
    if (!fs.existsSync(this.dirs.runs)) return [];
    return fs.readdirSync(this.dirs.runs).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  }

  readRun(id) {
    const p = path.join(this.dirs.runs, id + '.json');
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  }

  writeRun(run) {
    fs.writeFileSync(path.join(this.dirs.runs, run.id + '.json'), JSON.stringify(run, null, 2), 'utf8');
  }

  readAllRuns() {
    return this.listRunIds().map((id) => this.readRun(id)).filter(Boolean);
  }

  findRun(idOrPrefix) {
    if (!idOrPrefix) return null;
    const exact = this.readRun(idOrPrefix);
    if (exact) return exact;
    const match = this.listRunIds().find((id) => id.indexOf(idOrPrefix) === 0);
    return match ? this.readRun(match) : null;
  }

  // ---- reports — human-readable Markdown, meant to be committed/shared ----
  writeReport(filename, content) {
    const p = path.join(this.dirs.reports, filename);
    fs.writeFileSync(p, content, 'utf8');
    return p;
  }

  // ---- judge cache — avoids re-paying for identical (input, criteria, output) judgements ----
  cacheGet(key) {
    const p = path.join(this.dirs.cache, key + '.json');
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
  }

  cacheSet(key, value) {
    fs.writeFileSync(path.join(this.dirs.cache, key + '.json'), JSON.stringify(value), 'utf8');
  }
}

module.exports = { Workspace, defaultRoot };
