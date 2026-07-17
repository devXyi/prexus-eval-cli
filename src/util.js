'use strict';

function uid(prefix) {
  const p = prefix ? prefix + '_' : '';
  return p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function truncate(s, n) {
  if (!s) return '';
  const clean = String(s).replace(/\s+/g, ' ').trim();
  const max = n || 60;
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function pad(s, n) {
  const str = String(s);
  return str.length >= n ? str.slice(0, n) : str + ' '.repeat(n - str.length);
}

function bar(pct, width) {
  const w = width || 20;
  const filled = Math.max(0, Math.min(w, Math.round((pct / 100) * w)));
  return '█'.repeat(filled) + '░'.repeat(w - filled);
}

// splits on whitespace, respecting "quoted strings" as single tokens
function tokenize(str) {
  const tokens = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (/\s/.test(c) && !inQuotes) {
      if (cur) { tokens.push(cur); cur = ''; }
      continue;
    }
    cur += c;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

// pulls --flag value / --flag(bool) pairs out of a token array
function parseFlags(tokens) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].startsWith('--')) {
      const key = tokens[i].slice(2);
      const hasVal = tokens[i + 1] !== undefined && !tokens[i + 1].startsWith('--');
      const val = hasVal ? tokens[++i] : true;
      flags[key] = val;
    } else {
      rest.push(tokens[i]);
    }
  }
  return { flags, rest };
}

function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return '•'.repeat(k.length);
  return k.slice(0, 4) + '•'.repeat(Math.max(4, k.length - 8)) + k.slice(-4);
}

// FNV-1a — small, dependency-free, non-cryptographic. Good enough for judge-cache keys, not for security.
function hashContent(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

// minimal ANSI helpers — deliberately no chalk/kleur dependency, keeps `npm install` to one real package
const isTTY = !!(process.stdout && process.stdout.isTTY);
function wrap(code) {
  return (s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));
}
const colors = {
  amber: wrap('38;5;214'),
  green: wrap('38;5;79'),
  red: wrap('38;5;203'),
  gray: wrap('38;5;245'),
  bold: wrap('1'),
};

module.exports = { uid, truncate, pad, bar, tokenize, parseFlags, maskKey, hashContent, colors };
