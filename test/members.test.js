"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const {Collection} = require("discord.js");

// Env factices : lib/members.js → lib/crypto.js → lib/config.js.
process.env.BOT_LANGUAGE = "en";
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";

// Isolation : le jeton de cooldown (members.state.json) vit dans un dossier
// temporaire — jamais dans le vrai .apach/.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "apach-members-"));
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

const {refreshMembers, readPersistedRoster} = require("../lib/members");

function fakeGuild(cacheEntries = []) {
  const cache = new Collection(cacheEntries);
  const fetches = [];
  const guild = {
    members: {
      cache,
      fetch: async () => {
        fetches.push(1);
        cache.set("a", {id: "a", user: {username: "Alice"}});
        cache.set("b", {id: "b", user: {username: "Bob"}});
      },
    },
  };
  return {guild, fetches};
}

test("members: cache chaud → aucun rechargement", async () => {
  const {guild, fetches} = fakeGuild([["x", {id: "x", user: {username: "Xavier"}}]]);
  assert.equal(await refreshMembers(guild), false);
  assert.equal(fetches.length, 0);
});

test("members: cache vide → un chargement complet, jeton persisté", async () => {
  const {guild, fetches} = fakeGuild();
  assert.equal(await refreshMembers(guild), true);
  assert.equal(fetches.length, 1);
  assert.equal(guild.members.cache.size, 2);
  assert.ok(fs.existsSync(path.join(tmpDir, "members.state.json")), "jeton de date persisté");
});

test("members: cooldown persistant → pas de second chargement rapproché", async () => {
  fs.writeFileSync(path.join(tmpDir, "members.state.json"), JSON.stringify({fetchedAt: Date.now()}));
  const {guild, fetches} = fakeGuild();
  assert.equal(await refreshMembers(guild), false);
  assert.equal(fetches.length, 0);
});

test("members: échec du chargement → false sans crash", async () => {
  fs.rmSync(path.join(tmpDir, "members.state.json"), {force: true});
  const cache = new Collection();
  const guild = {members: {cache, fetch: async () => { throw new Error("request with opcode 8 was rate limited"); }}};
  assert.equal(await refreshMembers(guild), false);
  assert.equal(cache.size, 0);
});

test("members: un chargement réussi persiste la liste des membres", async () => {
  fs.rmSync(path.join(tmpDir, "members.state.json"), {force: true});
  fs.rmSync(path.join(tmpDir, "members.roster.json"), {force: true});
  const {guild} = fakeGuild();
  assert.equal(await refreshMembers(guild), true);
  const roster = readPersistedRoster();
  assert.deepEqual(roster.map((m) => m.username).sort(), ["Alice", "Bob"]);
});

test("members: cache chaud → liste persistée rafraîchie sans rechargement", async () => {
  const {guild, fetches} = fakeGuild([["x", {id: "x", user: {username: "Xavier"}}]]);
  await refreshMembers(guild);
  assert.equal(fetches.length, 0);
  assert.deepEqual(readPersistedRoster().map((m) => m.username), ["Xavier"]);
});

test("members: liste persistée trop vieille (24 h) → ignorée", async () => {
  fs.writeFileSync(path.join(tmpDir, "members.roster.json"), JSON.stringify({
    savedAt: Date.now() - 25 * 60 * 60_000,
    members: [{id: "z", username: "Zed"}],
  }));
  assert.deepEqual(readPersistedRoster(), []);
});
