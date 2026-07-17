# prexus-eval

A local-first, multi-provider LLM eval CLI: golden test sets, LLM-as-judge scoring,
regression tracking across prompt/model changes, and failure-mode taxonomies — all
running as a real terminal tool on your machine, the way you'd expect from something
in the git/docker/aws-cli family.

This is the "real" version of the browser-based artifact: provider keys live in your
**OS keychain** (Keychain on macOS, Credential Manager on Windows, Secret Service on
Linux), the workspace is a **real directory of files** you can put under git, and
every provider call is a normal server-side HTTP request — no browser CORS limitations,
so OpenAI and Google work exactly as reliably as Anthropic or OpenRouter.

## Install

```bash
cd prexus-eval-cli
npm install
npm link        # makes `prexus-eval` available globally, or run `node bin/prexus-eval.js` directly
```

The only real dependency is [`@napi-rs/keyring`](https://www.npmjs.com/package/@napi-rs/keyring),
a Rust-backed native binding to the OS keychain APIs. It's the actively maintained
successor to `keytar`, which GitHub archived in December 2022 — this project
deliberately does not use keytar. On Linux it talks to the Secret Service D-Bus API
directly rather than shelling out to `libsecret`, so it typically doesn't need extra
system packages, but check the package's own README if `npm install` fails on your
distro.

Requires Node 18+ (for built-in `fetch`).

## Quick start

```bash
prexus-eval
```

A demo test set and prompt are already loaded, so you can see the shape of things
immediately once a provider is configured:

```
❯ provider add anthropic
enter API key for "anthropic" (stored in your OS keychain, not in this workspace):
****************************************
✓ key verified — reached anthropic successfully, saved to your OS keychain

❯ judge use anthropic
judge set to "anthropic" — stays fixed across runs so regression comparisons remain valid

❯ run gen
running "demo" (4 cases) via anthropic (claude-opus-4-8) — judge: anthropic — label: v1
...
```

From there:

```
❯ testset new my-agent-evals
❯ case add --input "..." --expected "..." --criteria "..."
❯ prompt set "You are ..."
❯ run gen --label baseline
❯ run gen --label v2                 # after changing the prompt or provider
❯ compare <run1> <run2>              # regression diff
❯ taxonomy                           # failure-mode breakdown across all runs
❯ report compare <run1> <run2>       # writes reports/compare-<a>-<b>.md
```

Type `help` at any time for the full command reference, or `security` to see exactly
what this tool does and doesn't do with your keys and data, or `diagnostics` to
verify filesystem, keychain, and provider connectivity for real, live, on your machine.

## Workspace layout

Defaults to `~/.prexus-eval/` (override with `--workspace <path>` or the
`PREXUS_EVAL_HOME` environment variable):

```
~/.prexus-eval/
├── config.json       # active test set / provider / judge, provider metadata (no secrets)
├── datasets/         # one JSON file per test set
├── prompts/          # named, saved system prompts
├── runs/             # one JSON file per eval run
├── reports/          # Markdown reports written by `report run` / `report compare`
└── cache/            # judge-result cache, keyed by content hash
```

Everything except your provider keys (which live in the OS keychain) is a plain file
here — commit `datasets/` and `prompts/` to git, diff `runs/` in PRs, whatever fits
your workflow.

## Multi-model regression tracking

`judge use <provider>` fixes which provider grades every run. This is deliberate: if
the judge itself changed between two runs you're comparing, a score delta could mean
"the system under test got worse" or "the grader got stricter" — there's no way to
tell them apart. Keeping the judge constant is what makes `compare` meaningful.

The provider being *evaluated* (`run gen --provider <name>`, or whatever `provider use`
points at) is free to change from run to run — that's the whole point of regression
tracking across model/prompt changes.

## License

MIT
