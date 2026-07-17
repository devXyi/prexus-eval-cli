'use strict';

const readline = require('readline');
const { Workspace, defaultRoot } = require('./workspace');
const { dispatch, seedDemo } = require('./commands');
const { colors } = require('./util');

function colorFor(type) {
  switch (type) {
    case 'pass': return colors.green;
    case 'fail': return colors.red;
    case 'error': return colors.red;
    case 'warn': return colors.amber;
    case 'header': return colors.bold;
    case 'muted': return colors.gray;
    default: return (s) => s;
  }
}

function print(type, text) {
  if (type === 'input') { console.log(colors.amber('❯ ') + text); return; }
  console.log(colorFor(type)(text));
}

// Node's readline has no built-in masked-input mode, so this takes raw control of stdin while
// the main `rl` interface is paused, echoing '*' per character, then hands control back.
function askMasked(rl) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) { resolve(''); return; }

    rl.pause();
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';
    let resolved = false;

    function finish(value) {
      if (resolved) return;
      resolved = true;
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw || false);
      process.stdout.write('\n');
      rl.resume();
      resolve(value);
    }

    function onData(chunk) {
      const str = chunk.toString();
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '\r' || ch === '\n') { finish(input); return; }
        if (ch === '\u0003' || ch === '\u001b') { finish(null); return; } // Ctrl+C or Esc cancels this prompt only
        if (ch === '\u007f' || ch === '\b') {
          if (input.length) { input = input.slice(0, -1); process.stdout.write('\b \b'); }
          continue;
        }
        input += ch;
        process.stdout.write('*');
      }
    }

    stdin.on('data', onData);
  });
}

function printBanner(ws, firstRun) {
  print('header', 'prexus-eval — local-first LLM eval CLI');
  print('muted', 'grading: 5 flawless · 4 minor · 3 partial · 2 major · 1 wrong');
  print('muted', `workspace: ${ws.root}`);
  if (firstRun) {
    print('output', 'before you start:');
    print('output', '  [1] provider add <name>     e.g. provider add anthropic — key goes straight to your OS keychain');
    print('output', '  [2] judge use <name>        fix which provider grades every run (must be set before run gen)');
    print('output', '  [3] diagnostics             confirm filesystem + keychain + provider connectivity');
    print('muted', 'a demo test set and prompt are already loaded — type "help" any time');
  } else {
    print('muted', 'type "help" for commands');
  }
}

async function main() {
  const wsFlagIdx = process.argv.indexOf('--workspace');
  const root = wsFlagIdx !== -1 ? process.argv[wsFlagIdx + 1] : defaultRoot();
  const ws = new Workspace(root);

  const firstRun = !ws.exists();
  ws.init();
  if (firstRun) seedDemo(ws);

  printBanner(ws, firstRun);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.amber('❯ '),
    historySize: 500,
  });

  const ctx = {
    ws,
    print,
    askMasked: () => askMasked(rl),
    clear: () => { console.clear(); },
    exit: () => { rl.close(); },
  };

  rl.prompt();
  rl.on('line', async (line) => {
    try {
      await dispatch(ctx, line);
    } catch (e) {
      print('error', `unexpected error: ${e.message}`);
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('');
    process.exit(0);
  });
}

module.exports = { main };
