"use strict";
// Environnement factice AVANT le chargement des modules : sans ces valeurs,
// lib/config.js lèverait une erreur de configuration manquante. Les valeurs
// réelles éventuellement présentes dans l'environnement sont conservées.
process.env.BOT_LANGUAGE = "en";
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";

const test = require("node:test");
const assert = require("node:assert/strict");

// ── Isolation du fichier d'état (commands.hash) ─────────────────────────
// deploy.js lit/écrit paths.commandsHashFile : on injecte un faux module
// paths AVANT le require, comme dans power.test.js — les tests n'écrivent
// jamais dans le vrai .apach/commands.hash.
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const tmpDir = path.join(os.tmpdir(), `apach-deploy-${Date.now()}-${Math.random()}`);
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

const {commandsHash, friendlyDeployError, readDeployState, deployCommandsIfNeeded} = require("../lib/deploy");
const {cfg} = require("../lib/config");

// Faux REST : journalise les PUT au lieu d'appeler l'API Discord.
function makeRest() {
  const calls = [];
  return {
    calls,
    put: async (route, opts) => { calls.push({route, body: opts.body}); return true; },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// commandsHash — le cœur déterministe du mécanisme d'idempotence
// (SHA-256 de JSON.stringify({guild, app, cmds})).
// ═══════════════════════════════════════════════════════════════════════

test("deploy: commandsHash est déterministe (deux appels consécutifs → même hash)", () => {
  const h1 = commandsHash();
  const h2 = commandsHash();
  assert.equal(h2, h1);
});

test("deploy: commandsHash est une chaîne de 64 caractères hexadécimaux", () => {
  const hash = commandsHash();
  assert.equal(typeof hash, "string");
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("deploy: commandsHash est sensible à la guilde", () => {
  const original = cfg.guild_id;
  try {
    const h1 = commandsHash();
    // Changer de guilde doit forcer un ré-enregistrement : le hash doit changer.
    cfg.guild_id = "999999";
    const h2 = commandsHash();
    assert.notEqual(h2, h1);
  } finally {
    // Restauration systématique : cfg est un objet mutable partagé.
    cfg.guild_id = original;
  }
});

test("deploy: commandsHash est sensible à l'application", () => {
  const original = cfg.client_id;
  try {
    const h1 = commandsHash();
    // Changer d'application (client Discord) doit également invalider le hash.
    cfg.client_id = "12345678901234567890";
    const h2 = commandsHash();
    assert.notEqual(h2, h1);
  } finally {
    cfg.client_id = original;
  }
});

test("deploy: friendlyDeployError traduit 50001 Missing Access", () => {
  const e = friendlyDeployError({code: 50001});
  assert.equal(e.exitCode, 78, "problème de config → exit 78 (pas de boucle PM2)");
  assert.match(e.message, /50001/);
  assert.match(e.message, /888/, "la guilde configurée est citée");
  assert.match(e.message, /applications\.commands/, "l'URL d'invite est fournie");
});

test("deploy: friendlyDeployError traduit 10002 Unknown Application", () => {
  const e = friendlyDeployError({code: 10002});
  assert.equal(e.exitCode, 78);
  assert.match(e.message, /DISCORD_CLIENT_ID/);
});

test("deploy: friendlyDeployError laisse passer les autres erreurs", () => {
  const original = new Error("network down");
  assert.equal(friendlyDeployError(original), original);
  const other = {code: 50013}; // erreur Discord inconnue → inchangée
  assert.equal(friendlyDeployError(other), other);
});

// ═══════════════════════════════════════════════════════════════════════
// readDeployState — état persisté {guild, hash} + format hérité
// ═══════════════════════════════════════════════════════════════════════

test("deploy: readDeployState lit le format JSON {guild, hash}", () => {
  fs.writeFileSync(tmpPath("commands.hash"), JSON.stringify({guild: "888", hash: "abc123"}));
  const s = readDeployState();
  assert.equal(s.guild, "888");
  assert.equal(s.hash, "abc123");
});

test("deploy: readDeployState lit le format hérité (hex 64) et suppose la guilde courante", () => {
  const hex = "a".repeat(64);
  fs.writeFileSync(tmpPath("commands.hash"), hex);
  const s = readDeployState();
  assert.equal(s.hash, hex);
  assert.equal(s.guild, cfg.guild_id);
});

test("deploy: readDeployState tolère un contenu corrompu → null", () => {
  fs.writeFileSync(tmpPath("commands.hash"), "not json at all");
  assert.equal(readDeployState(), null);
});

test("deploy: readDeployState → null si le fichier est absent", () => {
  fs.rmSync(tmpPath("commands.hash"), {force: true});
  assert.equal(readDeployState(), null);
});

// ═══════════════════════════════════════════════════════════════════════
// deployCommandsIfNeeded — purge anti-doublons + idempotence
// ═══════════════════════════════════════════════════════════════════════

test("deploy: purge TOUJOURS les commandes globales, même hash inchangé", async () => {
  const hash = commandsHash();
  fs.writeFileSync(tmpPath("commands.hash"), JSON.stringify({guild: cfg.guild_id, hash}));
  const rest = makeRest();
  await deployCommandsIfNeeded(rest);
  const global = rest.calls.find((c) => !c.route.includes("/guilds/"));
  assert.ok(global, "purge globale effectuée à chaque démarrage");
  assert.deepEqual(global.body, [], "purge = body vide");
  assert.match(global.route, /\/applications\/test-client\/commands$/);
  assert.equal(rest.calls.length, 1, "aucun PUT guilde quand le hash est inchangé");
});

test("deploy: hash changé → PUT guilde + état persisté {guild, hash}", async () => {
  fs.writeFileSync(tmpPath("commands.hash"), JSON.stringify({guild: cfg.guild_id, hash: "oldhash"}));
  const rest = makeRest();
  await deployCommandsIfNeeded(rest);
  const guildPut = rest.calls.find((c) => c.route.includes("/guilds/"));
  assert.ok(guildPut, "PUT guilde effectué");
  assert.ok(Array.isArray(guildPut.body) && guildPut.body.length > 0, "body = liste des commandes");
  assert.match(guildPut.route, new RegExp(`/guilds/${cfg.guild_id}/commands$`));
  const saved = readDeployState();
  assert.equal(saved.hash, commandsHash());
  assert.equal(saved.guild, cfg.guild_id);
});

test("deploy: changement de guilde → purge de l'ancienne guilde AVANT le nouveau PUT", async () => {
  fs.writeFileSync(tmpPath("commands.hash"), JSON.stringify({guild: "777", hash: "oldhash"}));
  const rest = makeRest();
  await deployCommandsIfNeeded(rest);
  const oldGuild = rest.calls.find((c) => c.route.includes("/guilds/777/commands"));
  assert.ok(oldGuild, "ancienne guilde purgée");
  assert.deepEqual(oldGuild.body, [], "purge = body vide");
  const newGuild = rest.calls.find((c) => c.route.includes(`/guilds/${cfg.guild_id}/commands`));
  assert.ok(newGuild, "nouvelles commandes enregistrées");
  const saved = readDeployState();
  assert.equal(saved.guild, cfg.guild_id, "l'état persisté pointe la nouvelle guilde");
});

test("deploy: la purge globale échoue → best-effort, le déploiement continue", async () => {
  fs.writeFileSync(tmpPath("commands.hash"), JSON.stringify({guild: cfg.guild_id, hash: "oldhash"}));
  const rest = {
    calls: [],
    put: async (route, opts) => {
      rest.calls.push({route, body: opts.body});
      if (!route.includes("/guilds/")) throw new Error("network down");
      return true;
    },
  };
  await deployCommandsIfNeeded(rest); // ne doit PAS lever
  assert.ok(rest.calls.some((c) => c.route.includes(`/guilds/${cfg.guild_id}/commands`)), "PUT guilde exécuté malgré l'échec de purge");
});
