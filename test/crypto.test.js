"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

// Env factices : lib/crypto.js → lib/config.js.
process.env.BOT_LANGUAGE = "en";
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";

// Isolation : fichiers d'état dans un dossier temporaire.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "apach-crypto-"));
const pathsPath = require.resolve("../lib/paths");
require.cache[pathsPath] = {
  id: pathsPath,
  filename: pathsPath,
  loaded: true,
  exports: {
    ROOT: tmpDir,
    envFile: path.join(tmpDir, ".env"),
    apachDir: tmpDir,
    logsDir: tmpDir,
    logFile: path.join(tmpDir, "apach-bot.log"),
    usersFile: path.join(tmpDir, "users.json"),
    legacyUsersFile: path.join(tmpDir, "apach-users.json"),
    sessionsFile: path.join(tmpDir, "sessions.json"),
    lockFile: path.join(tmpDir, "active.lock"),
    commandsHashFile: path.join(tmpDir, "commands.hash"),
    emojisFile: path.join(tmpDir, "emojis.json"),
    membersStateFile: path.join(tmpDir, "members.state.json"),
    membersRosterFile: path.join(tmpDir, "members.roster.json"),
  },
  children: [],
  paths: [],
};

const {encryptJson, decryptJson, readJson, writeJson} = require("../lib/crypto");

test("crypto: aller-retour chiffré/déchiffré", () => {
  const obj = {users: ["123456", "789"], rosters: [{id: "1", username: "bob"}]};
  assert.deepEqual(decryptJson(encryptJson(obj)), obj);
});

test("crypto: le chiffré ne laisse jamais fuiter le contenu en clair", () => {
  const secret = "1477929253072011266";
  const blob = encryptJson([secret]);
  assert.ok(!blob.includes(secret), "l'ID n'apparaît pas dans le blob");
});

test("crypto: altération du chiffré → rejet (tag GCM)", () => {
  const blob = Buffer.from(encryptJson({ok: true}), "base64");
  blob[blob.length - 1] ^= 0x01; // flip du dernier octet
  assert.throws(() => decryptJson(blob.toString("base64")), /bad decrypt|unable to auth|Invalid/);
});

test("crypto: writeJson/readJson — fichier chiffré sur disque, relu à l'identique", () => {
  const file = path.join(tmpDir, "state-test.json");
  writeJson(file, {alias: "main", userId: "42"});
  const raw = fs.readFileSync(file, "utf8");
  assert.ok(!raw.includes("\"main\""), "contenu chiffré, pas de JSON en clair");
  assert.ok(!raw.includes("42"), "les valeurs ne sont pas lisibles en clair");
  assert.deepEqual(readJson(file), {alias: "main", userId: "42"});
});

test("crypto: fichier clair hérité → toujours lisible (migration silencieuse)", () => {
  const file = path.join(tmpDir, "legacy-test.json");
  fs.writeFileSync(file, JSON.stringify(["123"]));
  assert.deepEqual(readJson(file), ["123"]);
});

test("crypto: fichier absent ou vide → undefined", () => {
  assert.equal(readJson(path.join(tmpDir, "inexistant.json")), undefined);
  const empty = path.join(tmpDir, "vide.json");
  fs.writeFileSync(empty, "");
  assert.equal(readJson(empty), undefined);
});
