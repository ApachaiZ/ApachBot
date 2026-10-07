"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Env factices — requis car lib/state.js importe lib/config.js, qui valide au require.
// Forcer la langue : les assertions vérifient des chaînes anglaises littérales.
process.env.BOT_LANGUAGE = "en";
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";

const {loadUsers} = require("../lib/state");

function withTempFile(content, fn) {
  const file = path.join(os.tmpdir(), `apach-users-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(file, content);
  try { fn(file); } finally { try { fs.unlinkSync(file); } catch {} }
}

test("loadUsers: fichier absent → tableau vide", () => {
  const missing = path.join(os.tmpdir(), `does-not-exist-${Date.now()}.json`);
  assert.deepEqual(loadUsers(missing), []);
});

test("loadUsers: fichier illisible (ni chiffré ni JSON) → throw clair", () => {
  withTempFile("{ invalid", (file) => {
    assert.throws(() => loadUsers(file), /expected an array/);
  });
});

test("loadUsers: non-tableau → throw clair", () => {
  withTempFile('{"a":1}', (file) => {
    assert.throws(() => loadUsers(file), /expected an array/);
  });
});

test("loadUsers: filtre les entrées invalides (nombres, chaînes mixtes)", () => {
  withTempFile('["123", 42, "abc", "456"]', (file) => {
    assert.deepEqual(loadUsers(file), ["123", "456"]);
  });
});

test("loadUsers: déduplique les doublons", () => {
  withTempFile('["123", "123", "456"]', (file) => {
    assert.deepEqual(loadUsers(file), ["123", "456"]);
  });
});
