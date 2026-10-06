"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

// ── Isolation du chemin du fichier de logs ──────────────────────────────
// lib/logs.js lit `logFile` depuis "./paths" (chemin réel logs/apach-bot.log,
// contenu non déterministe). On injecte un faux module paths dans le cache
// require AVANT de charger logs : tous les requires ultérieurs de "./paths"
// (logs.js, state.js, config.js, logger.js) reçoivent ce faux. Toutes les
// clés pointent vers des fichiers temporaires (y compris celles utilisées
// par state.js) : les fichiers d'état réels ne sont jamais lus ni modifiés,
// et aucun fs.existsSync ne reçoit undefined (avertissement DEP0187).
const tmpDir = path.join(os.tmpdir(), `apach-fake-${Date.now()}-${Math.random()}`);
fs.mkdirSync(tmpDir, {recursive: true});
const tmpFile = path.join(tmpDir, "apach-bot.log");
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
    logFile: tmpFile,
    usersFile: tmpPath("users.json"),
    legacyUsersFile: tmpPath("apach-users.json"),
    sessionsFile: tmpPath("sessions.json"),
    lockFile: tmpPath("active.lock"),
    commandsHashFile: tmpPath("commands.hash"),
  },
  children: [],
  paths: [],
};

// Env factices — requis car logs.js importe lib/state.js (réel), qui importe
// lib/config.js et valide l'environnement au require. isOwner (state réel)
// accepte l'owner "999" ; "888" sert au refus d'accès.
process.env.BOT_LANGUAGE = "en";
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";

const {logs} = require("../lib/logs");

// Mock d'interaction minimal : identité utilisateur, option "filter" et
// editReply qui capture le payload renvoyé par la commande.
function fakeInteraction(userId, filter) {
  let sent = null;
  const i = {
    user: {id: userId},
    options: {getString: () => (filter == null ? null : filter)},
    editReply: async (payload) => { sent = payload; },
  };
  return {i, captured: () => sent};
}

// Écrit le contenu dans le fichier tmp et garantit son nettoyage (finally).
function withLogContent(content, fn) {
  fs.writeFileSync(tmpFile, content);
  try {
    return fn();
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// Supprime le fichier tmp s'il existe (cas ENOENT) ; nettoyage en finally.
function withoutLogFile(fn) {
  try { fs.unlinkSync(tmpFile); } catch {}
  try {
    return fn();
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

test("logs: refuse l'accès à un utilisateur non-owner", async () => {
  withLogContent("secret line\n", () => {}); // le fichier ne doit même pas être lu
  const {i, captured} = fakeInteraction("888", null);
  await logs(i);
  const e = captured().embeds[0].data;
  assert.equal(e.title, "Access denied");
  assert.equal(e.description, "Only the configured owner can view logs.");
});

test("logs: renvoie exactement les 30 dernières lignes non vides", async () => {
  const lines = Array.from({length: 40}, (_, n) => `line ${n + 1}`);
  // Lignes vides en fin de fichier : elles doivent être ignorées par readTail.
  withLogContent(lines.join("\n") + "\n\n", async () => {
    const {i, captured} = fakeInteraction("999", null);
    await logs(i);
    const e = captured().embeds[0].data;
    const expected = lines.slice(-30).join("\n");
    assert.equal(e.title, "📜 Last 30 log lines");
    assert.equal(e.description, "```\n" + expected + "\n```");
  });
});

test("logs: filtre insensible à la casse et titre filtré", async () => {
  const lines = ["alpha one", "beta two", "ALPHA three", "gamma", "alpha four"];
  withLogContent(lines.join("\n") + "\n", async () => {
    const {i, captured} = fakeInteraction("999", "ALPHA");
    await logs(i);
    const e = captured().embeds[0].data;
    assert.equal(e.title, '📜 3 line(s) matching "alpha"');
    assert.equal(e.description, "```\nalpha one\nALPHA three\nalpha four\n```");
  });
});

test("logs: fichier absent → carte notFound", async () => {
  withoutLogFile(async () => {
    const {i, captured} = fakeInteraction("999", null);
    await logs(i);
    const e = captured().embeds[0].data;
    assert.equal(e.title, "📜 Logs");
    assert.equal(e.description, "Log file not found.");
  });
});

test("logs: fichier vide → carte empty", async () => {
  withLogContent("", async () => {
    const {i, captured} = fakeInteraction("999", null);
    await logs(i);
    const e = captured().embeds[0].data;
    assert.equal(e.title, "📜 Logs");
    assert.equal(e.description, "Log file is empty.");
  });
});

test("logs: filtre sans correspondance → carte nothingFiltered", async () => {
  withLogContent("beta one\ngamma two\n", async () => {
    const {i, captured} = fakeInteraction("999", "ALPHA");
    await logs(i);
    const e = captured().embeds[0].data;
    assert.equal(e.title, "📜 Logs");
    assert.equal(e.description, 'No lines matched "alpha".');
  });
});

test("logs: tronque le corps au-delà de 1800 caractères avec préfixe « … »", async () => {
  // 10 lignes de 200 caractères → corps de 2009 caractères (> MAX_CHARS).
  const lines = Array.from({length: 10}, () => "x".repeat(200));
  withLogContent(lines.join("\n") + "\n", async () => {
    const {i, captured} = fakeInteraction("999", null);
    await logs(i);
    const e = captured().embeds[0].data;
    assert.equal(e.title, "📜 Last 10 log lines");
    assert.ok(e.description.startsWith("```\n…\n"), "corps précédé de « … »");
    assert.equal(e.description.length, 1810, "1800 caractères max + habillage code");
    assert.ok(e.description.endsWith("x".repeat(200) + "\n```"), "dernière ligne conservée");
  });
});
