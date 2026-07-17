'use strict';

// @napi-rs/keyring binds the Rust `keyring` crate (github.com/hwchen/keyring-rs) via napi.rs.
// It is the actively-maintained modern replacement for `keytar`, which GitHub archived in Dec 2022
// and has not been updated since Feb 2022 — do not add keytar to this project.
//
// Real API (confirmed from the package's own README):
//   const { Entry } = require('@napi-rs/keyring');
//   const entry = new Entry(service, account);
//   entry.setPassword(secret);       // sync
//   const secret = entry.getPassword(); // sync, throws if no entry exists
//   entry.deletePassword();          // sync

const SERVICE = 'prexus-eval';

let Entry = null;
let loadError = null;

try {
  Entry = require('@napi-rs/keyring').Entry;
} catch (e) {
  loadError = e;
}

function isAvailable() {
  return !!Entry;
}

function getLoadError() {
  return loadError;
}

function setSecret(account, secret) {
  if (!Entry) throw new Error('keychain module not loaded — run `npm install` (see `security` for details)');
  const entry = new Entry(SERVICE, account);
  entry.setPassword(secret);
}

function getSecret(account) {
  if (!Entry) return null;
  try {
    const entry = new Entry(SERVICE, account);
    return entry.getPassword();
  } catch (e) {
    return null; // no entry yet, or OS keychain locked/denied access
  }
}

function deleteSecret(account) {
  if (!Entry) return false;
  try {
    const entry = new Entry(SERVICE, account);
    entry.deletePassword();
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { isAvailable, getLoadError, setSecret, getSecret, deleteSecret, SERVICE };
