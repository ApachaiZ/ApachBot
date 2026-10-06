"use strict";
const fs = require("node:fs");
const path = require("node:path");
const {cfg} = require("./config");
const {usersFile: store, legacyUsersFile: legacyStore, sessionsFile, lockFile} = require("./paths");
const {t} = require("./i18n");
const logger = require("./logger");

// Migration silencieuse : si l'ancien emplacement (racine) existe et que le
// nouveau n'existe pas encore, on déplace le fichier. En cas d'échec (droits,
// FS read-only…), on ignore : le prochain save() recréera le fichier au bon
// endroit. Aucune donnée n'est perdue tant que l'ancien fichier reste lisible.
try {
  if (fs.existsSync(legacyStore) && !fs.existsSync(store)) {
    fs.mkdirSync(path.dirname(store), {recursive: true});
    fs.renameSync(legacyStore, store);
  }
} catch {}

// `file` est optionnel : en production, la liste est lue depuis le chemin
// canonique (paths.usersFile). Le paramètre existe pour les tests, qui
// exercent la validation sur des fichiers temporaires.
function loadUsers(file = store) {
  if (!fs.existsSync(file)) return [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    logger.error(t("audit.usersParseFailed", {error: err.message}));
    throw new Error(t("errors.invalidUsersJsonParse"));
  }
  if (!Array.isArray(data)) {
    logger.error(t("audit.usersNotArray"));
    throw new Error(t("errors.invalidUsersJsonShape"));
  }
  const clean = [];
  for (const x of data) {
    if (typeof x !== "string" || !/^\d+$/.test(x)) {
      logger.warn(t("audit.usersInvalidEntry", {entry: x}));
      continue;
    }
    if (!clean.includes(x)) clean.push(x);
  }
  return clean;
}

let users = loadUsers();

let writeQueue = Promise.resolve();
function save(next) {
  const run = () => {
    const temp = store + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(next, null, 2), {mode: 0o600});
    try { fs.chmodSync(temp, 0o600); } catch {}
    fs.renameSync(temp, store);
    users = next;
  };
  writeQueue = writeQueue.then(run, run);
  return writeQueue;
}
function getUsers() { return users; }

const LOCK_TTL_MS = 11 * 60 * 1000;

// Le verrou est un objet {alias → {action, startedAt}} : un verrou par service.
function readLock() {
  try {
    const data = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const clean = {};
    for (const [alias, entry] of Object.entries(data)) {
      if (entry && typeof entry.action === "string" && Number.isFinite(entry.startedAt)) {
        clean[alias] = {action: entry.action, startedAt: entry.startedAt};
      }
    }
    return clean;
  } catch {}
  return {};
}

// Écriture atomique (tmp + rename) : un crash en cours d'écriture ne peut pas
// laisser un JSON tronqué que la prochaine lecture ignorerait silencieusement.
function writeLockFile(map) {
  try {
    fs.mkdirSync(path.dirname(lockFile), {recursive: true});
    const temp = lockFile + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(map, null, 2), {mode: 0o600});
    try { fs.chmodSync(temp, 0o600); } catch {}
    fs.renameSync(temp, lockFile);
  } catch (err) { logger.error(t("audit.lockWriteFailed", {error: err.message})); }
}

function writeLock(alias, action) {
  const map = readLock();
  map[alias] = {action, startedAt: Date.now()};
  writeLockFile(map);
}

function clearLock(alias) {
  const map = readLock();
  if (alias) {
    if (!(alias in map)) return;
    delete map[alias];
  }
  if (Object.keys(map).length === 0) {
    try { fs.unlinkSync(lockFile); } catch {}
    return;
  }
  writeLockFile(map);
}

// Lecture pure : retourne {alias → action} sans jamais écrire sur disque.
// Utilisé par les consommateurs en lecture seule (watchdog) pour éviter
// qu'un scan de surveillance ne déclenche une purge/écriture de active.lock.
function readLockSnapshot() {
  const map = readLock();
  const now = Date.now();
  const active = {};
  for (const [alias, entry] of Object.entries(map)) {
    if (now - entry.startedAt > LOCK_TTL_MS) continue;
    active[alias] = entry.action;
  }
  return active;
}

// Retourne {alias → action} en purgeant les entrées expirées.
function loadPersistedLock() {
  const map = readLock();
  const now = Date.now();
  const active = {};
  let changed = false;
  for (const [alias, entry] of Object.entries(map)) {
    if (now - entry.startedAt > LOCK_TTL_MS) { changed = true; continue; }
    active[alias] = entry.action;
  }
  if (changed) {
    if (Object.keys(active).length === 0) { try { fs.unlinkSync(lockFile); } catch {} }
    else {
      // Conserver le startedAt d'origine des verrous survivants : ne pas réinitialiser leur TTL.
      const survivors = {};
      for (const [alias, entry] of Object.entries(map)) {
        if (now - entry.startedAt > LOCK_TTL_MS) continue;
        survivors[alias] = entry;
      }
      writeLockFile(survivors);
    }
  }
  return active;
}

const isOwner = (id) => id === String(cfg.owner_id);
const isAllowed = (id) => isOwner(id) || users.includes(id);

// ── Sessions : service par défaut par utilisateur ──────────────
function readSessions() {
  try {
    const data = JSON.parse(fs.readFileSync(sessionsFile, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const clean = {};
    for (const [uid, alias] of Object.entries(data)) {
      if (typeof uid === "string" && typeof alias === "string") clean[uid] = alias;
    }
    return clean;
  } catch {}
  return {};
}

// Écriture atomique (tmp + rename), même garantie que writeLockFile.
function writeSessions(map) {
  try {
    fs.mkdirSync(path.dirname(sessionsFile), {recursive: true});
    const temp = sessionsFile + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(map, null, 2), {mode: 0o600});
    try { fs.chmodSync(temp, 0o600); } catch {}
    fs.renameSync(temp, sessionsFile);
  } catch (err) { logger.error(t("audit.sessionsWriteFailed", {error: err.message})); }
}

function getSession(userId) {
  const map = readSessions();
  return map[String(userId)] || null;
}

function setSession(userId, alias) {
  const map = readSessions();
  map[String(userId)] = alias;
  writeSessions(map);
}

function clearSession(userId) {
  const map = readSessions();
  const key = String(userId);
  if (!(key in map)) return;
  delete map[key];
  writeSessions(map);
}

module.exports = {loadUsers, save, getUsers, isOwner, isAllowed, writeLock, clearLock, loadPersistedLock, readLockSnapshot, getSession, setSession, clearSession};
