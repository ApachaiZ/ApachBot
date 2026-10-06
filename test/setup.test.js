"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");

// Isolation du chemin du .env : sans cela, ensureEnv lirait le vrai
// .apach/.env du projet et ne détecterait aucune clé manquante.
const envPath = require.resolve("../lib/paths");
require.cache[envPath] = {
  id: envPath,
  filename: envPath,
  loaded: true,
  exports: {envFile: path.join(os.tmpdir(), `apach-fake-env-${Date.now()}-${Math.random()}`)},
  children: [],
  paths: [],
};

const {parseEnv, ensureEnv, ConfigError} = require("../lib/setup");

const toObj = (map) => Object.fromEntries(map);

test("setup.parseEnv: lignes vides et commentaires ignorés", () => {
  assert.deepEqual(toObj(parseEnv("")), {});
  assert.deepEqual(toObj(parseEnv("# commentaire\n\n  # autre\n")), {});
});

test("setup.parseEnv: clés et valeurs trimées", () => {
  assert.deepEqual(toObj(parseEnv("A=1\nB = 2\n C =3 ")), {A: "1", B: "2", C: "3"});
});

test("setup.parseEnv: lignes sans '=' ignorées", () => {
  assert.deepEqual(toObj(parseEnv("BROKEN\n=value\nKEY=")), {KEY: ""});
});

test("setup.parseEnv: la dernière valeur gagne", () => {
  assert.deepEqual(toObj(parseEnv("A=1\nA=2")), {A: "2"});
});

test("setup.ensureEnv: non-interactif liste les clés manquantes et sort en 78", async () => {
  // Le vrai .apach/.env est chargé par i18n.js (dotenv) dans process.env au
  // moment du require : on purge donc explicitement les clés pour simuler
  // une machine vierge. Le faux paths pointe vers un .env inexistant.
  const keys = ["BOT_LANGUAGE", "DISCORD_TOKEN", "DISCORD_CLIENT_ID",
    "DISCORD_OWNER_ID", "DISCORD_GUILD_ID", "PROVIDER_API_KEY",
    "PROVIDER_SERVICE_ID", "PROVIDER_SERVICES"];
  const original = {};
  for (const k of keys) { original[k] = process.env[k]; delete process.env[k]; }
  try {
    await assert.rejects(ensureEnv({nonInteractive: true}), (err) => {
      assert.ok(err instanceof ConfigError, "doit être une ConfigError");
      assert.equal(err.exitCode, 78, "exit 78 = EX_CONFIG (stop_exit_codes PM2)");
      assert.match(err.message, /DISCORD_TOKEN/);
      assert.match(err.message, /PROVIDER_API_KEY/);
      assert.match(err.message, /PROVIDER_SERVICE_ID/);
      return true;
    });
  } finally {
    for (const k of keys) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  }
});

test("setup.ensureEnv: BOT_LANGUAGE absent n'est PAS bloquant (champ optionnel)", async () => {
  // Régression : un .env complet SANS BOT_LANGUAGE (défaut "en" côté i18n)
  // doit démarrer en non-interactif. Cas réel rapporté en production (PM2).
  const required = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_OWNER_ID",
    "DISCORD_GUILD_ID", "PROVIDER_API_KEY", "PROVIDER_SERVICE_ID"];
  const original = {};
  for (const k of required) { original[k] = process.env[k]; process.env[k] = "test-" + k; }
  const origLang = process.env.BOT_LANGUAGE;
  delete process.env.BOT_LANGUAGE;
  try {
    await assert.doesNotReject(ensureEnv({nonInteractive: true}));
  } finally {
    for (const k of required) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
    if (origLang === undefined) delete process.env.BOT_LANGUAGE;
    else process.env.BOT_LANGUAGE = origLang;
  }
});

test("setup.ensureEnv: non-interactif accepte les variables via l'environnement", async () => {
  // Si process.env fournit tout, ensureEnv ne doit rien exiger même sans .env.
  const original = {};
  const keys = ["BOT_LANGUAGE", "DISCORD_TOKEN", "DISCORD_CLIENT_ID",
    "DISCORD_OWNER_ID", "DISCORD_GUILD_ID", "PROVIDER_API_KEY", "PROVIDER_SERVICE_ID"];
  try {
    for (const k of keys) { original[k] = process.env[k]; process.env[k] = "test-" + k; }
    // Ne doit pas lever : toutes les clés sont présentes via process.env.
    await ensureEnv({nonInteractive: true});
  } finally {
    for (const k of keys) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  }
});
