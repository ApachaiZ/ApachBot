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
const {commandsHash, friendlyDeployError} = require("../lib/deploy");
const {cfg} = require("../lib/config");

// Aucun appel à deployCommandsIfNeeded() ici : il effectuerait un PUT réseau
// vers l'API Discord. On vérifie uniquement commandsHash(), le cœur déterministe
// du mécanisme d'idempotence (SHA-256 de JSON.stringify({guild, app, cmds})).

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
