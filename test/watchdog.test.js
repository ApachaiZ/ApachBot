"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

// Env factices — requis car lib/watchdog.js importe lib/config.js.
// Forcer la langue : les assertions vérifient des chaînes anglaises littérales.
// DISCORD_ALERT_CHANNEL_ID active le canal d'alerte (sinon sendAlert sort tôt).
process.env.BOT_LANGUAGE = "en";
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.DISCORD_ALERT_CHANNEL_ID) process.env.DISCORD_ALERT_CHANNEL_ID = "111";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";

// ── Isolation des chemins d'état ───────────────────────────────────────
// state.js (verrous, users) et logger.js utilisent "./paths" : on injecte un
// faux module pointant vers des fichiers temporaires AVANT tout require de
// lib/. writeLock/readLockSnapshot opèrent alors sur un active.lock de test,
// jamais sur le .apach/active.lock réel — le test ne peut plus entrer en
// course avec d'autres processus de test (power.test.js) ni avec un bot en
// cours d'exécution, et aucune ligne d'audit n'est écrite dans logs/ réel.
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const tmpDir = path.join(os.tmpdir(), `apach-fake-${Date.now()}-${Math.random()}`);
fs.mkdirSync(tmpDir, {recursive: true});
const tmpPath = (name) => path.join(tmpDir, name);
const pathsPath = require.resolve("../lib/paths");
require.cache[pathsPath] = {
  id: pathsPath,
  filename: pathsPath,
  loaded: true,
  exports: {
    ROOT: tmpDir,
    envFile: tmpPath(".env"),
    apachDir: tmpDir,
    logsDir: tmpDir,
    logFile: tmpPath("apach-bot.log"),
    usersFile: tmpPath("users.json"),
    legacyUsersFile: tmpPath("apach-users.json"),
    sessionsFile: tmpPath("sessions.json"),
    lockFile: tmpPath("active.lock"),
    commandsHashFile: tmpPath("commands.hash"),
  },
  children: [],
  paths: [],
};

const {start, stop, checkService, canAlert} = require("../lib/watchdog");
const api = require("../lib/api");
const {writeLock, clearLock} = require("../lib/state");
const yh = require("../lib/providers/yorkhost");

function fakeDiscordClient(capture) {
  const channel = {send: async (payload) => { capture.push(payload); }};
  return {channels: {cache: {get: () => channel}, fetch: async () => channel}};
}

test("watchdog.canAlert: cooldown — une alerte, puis silence", () => {
  assert.equal(canAlert("k:cooldown"), true);
  assert.equal(canAlert("k:cooldown"), false);
});

test("watchdog.checkService: alerte crash sur transition running → arrêt", async () => {
  const capture = [];
  let rawState = "online";
  const orig = yh.fetchRaw;
  yh.fetchRaw = async (client, id) => ({name: "srv", state: rawState, cpuPct: 10});
  start(fakeDiscordClient(capture));
  try {
    await checkService("w1", "svc-w1");
    assert.equal(capture.length, 0);
    rawState = "offline";
    api.clearCache("svc-w1");
    await checkService("w1", "svc-w1");
    assert.equal(capture.length, 1);
    assert.equal(capture[0].embeds[0].data.title, "🔴 Service **w1** down");
    assert.match(capture[0].embeds[0].data.description, /running → stopped/);
  } finally {
    yh.fetchRaw = orig;
    api.clearCache();
    stop();
  }
});

test("watchdog.checkService: pas d'alerte crash si un verrou est actif", async () => {
  const capture = [];
  let rawState = "online";
  const orig = yh.fetchRaw;
  yh.fetchRaw = async (client, id) => ({name: "srv", state: rawState, cpuPct: 10});
  start(fakeDiscordClient(capture));
  writeLock("wlock", "stop");
  try {
    await checkService("wlock", "svc-wlock");
    rawState = "offline";
    api.clearCache("svc-wlock");
    await checkService("wlock", "svc-wlock");
    assert.equal(capture.length, 0);
  } finally {
    clearLock("wlock");
    yh.fetchRaw = orig;
    api.clearCache();
    stop();
  }
});

test("watchdog.checkService: alertes CPU/RAM/disque au-dessus des seuils, avec cooldown", async () => {
  const capture = [];
  const orig = yh.fetchRaw;
  yh.fetchRaw = async () => ({
    name: "srv", state: "online", cpuPct: 95,
    ramMb: 950, ramMaxMb: 1000, diskMb: 950, diskMaxMb: 1000,
  });
  start(fakeDiscordClient(capture));
  try {
    await checkService("w2", "svc-w2");
    assert.equal(capture.length, 3);
    assert.equal(capture[0].embeds[0].data.title, "⚠ High CPU on **w2**");
    assert.equal(capture[1].embeds[0].data.title, "⚠ High memory on **w2**");
    assert.equal(capture[2].embeds[0].data.title, "⚠ Disk almost full on **w2**");
    // Cooldown : un second scan ne ré-alerte pas.
    api.clearCache("svc-w2");
    await checkService("w2", "svc-w2");
    assert.equal(capture.length, 3);
  } finally {
    yh.fetchRaw = orig;
    api.clearCache();
    stop();
  }
});

test("watchdog.checkService: état nominal → aucune alerte", async () => {
  const capture = [];
  const orig = yh.fetchRaw;
  yh.fetchRaw = async () => ({
    name: "srv", state: "online", cpuPct: 40,
    ramMb: 400, ramMaxMb: 1000, diskMb: 400, diskMaxMb: 1000,
  });
  start(fakeDiscordClient(capture));
  try {
    await checkService("w3", "svc-w3");
    assert.equal(capture.length, 0);
  } finally {
    yh.fetchRaw = orig;
    api.clearCache();
    stop();
  }
});

test("watchdog.checkService: propage l'échec de l'API (le tick le capture)", async () => {
  const orig = yh.fetchRaw;
  yh.fetchRaw = async () => { throw new Error("api down"); };
  try {
    api.clearCache();
    await assert.rejects(checkService("w4", "svc-w4"), /api down/);
  } finally {
    yh.fetchRaw = orig;
    api.clearCache();
  }
});
