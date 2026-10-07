"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const {Collection} = require("discord.js");

// ── Faux modules injectés AVANT tout require de manage ─────────────────────
// lib/manage.js déstructure {isOwner, getUsers, save} de "./state" et
// {confirm} de "./confirm" au chargement : on ne peut pas les patcher après
// coup. On remplace donc les entrées du cache require par des faux modules.
// paths.js est aussi isolé (members.js y lit le jeton de cooldown) : jamais
// d'écriture dans le vrai .apach/ pendant les tests.
function fakeModule(relPath, exports) {
  const filename = require.resolve(relPath);
  require.cache[filename] = {id: filename, filename, loaded: true, exports, children: [], paths: []};
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "apach-manage-"));
fakeModule("../lib/paths", {
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
});

// Chaque appel du faux state.save() pousse l'état suivant dans `saves` ;
// les tests remettent `saves.length` à 0 avant chaque scénario.
const saves = [];
fakeModule("../lib/confirm", {confirm: async () => true});
fakeModule("../lib/state", {
  // Le propriétaire est l'id "999" (DISCORD_OWNER_ID factice ci-dessous).
  isOwner: (id) => id === "999",
  getUsers: () => ["123"],
  save: async (next) => { saves.push(next); },
});

// ── Env factices (config.js réel est chargé par manage.js) ─────────────────
// La langue anglaise est forcée : les assertions comparent des chaînes
// littérales de lib/locales/en.js.
process.env.BOT_LANGUAGE = "en";
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";

const {manage, handleMemberAutocomplete} = require("../lib/manage");

// ── Fabrique d'interaction factice ─────────────────────────────────────────
// Le membre choisi arrive via l'option « member » (string, autocomplétion) :
// options.getString renvoie `targetId` (défaut "777"), ou null si `stale`
// (ancienne définition de commande en cache). guild.members.fetch renvoie
// `memberFor(targetId)` pour les appels ciblés, et le roster pour l'appel
// complet (autocomplétion).
function makeInteraction({id, sub, memberFor, targetId = "777", stale = false, cache}) {
  const edits = [];
  const followUps = [];
  const fetches = [];
  const rosterList = cache || new Collection([
    ["777", {id: "777", user: {bot: false, username: "bob"}}],
    ["999", {id: "999", user: {bot: false, username: "owner"}}],
  ]);
  const interaction = {
    user: {id},
    options: {
      getSubcommand: () => sub,
      getString: () => (stale ? null : targetId),
    },
    editReply: async (p) => { edits.push(p); },
    followUp: async (p) => { followUps.push(p); },
    guild: {
      members: {
        cache: rosterList,
        fetch: async (memberId) => {
          fetches.push(memberId);
          if (memberId === undefined) return rosterList;
          return memberFor(memberId);
        },
      },
    },
  };
  return {interaction, edits, followUps, fetches};
}

test("manage: accès refusé pour un utilisateur non-propriétaire", async () => {
  saves.length = 0;
  const {interaction, edits, followUps} = makeInteraction({
    id: "888", sub: "list", memberFor: () => null,
  });
  await manage(interaction);
  assert.equal(edits.length, 1);
  assert.equal(followUps.length, 0);
  assert.equal(saves.length, 0);
  const cardData = edits[0].embeds[0].data;
  assert.equal(cardData.title, "Access denied");
  assert.equal(cardData.description, "Only the configured owner can manage operators.");
});

test("manage: list affiche les pseudos, pas les IDs numériques", async () => {
  saves.length = 0;
  const {interaction, edits, followUps} = makeInteraction({
    id: "999", sub: "list",
    memberFor: (memberId) => ({user: {username: memberId === "999" ? "owner" : "user123"}}),
  });
  await manage(interaction);
  assert.equal(edits.length, 1);
  assert.equal(followUps.length, 0);
  const cardData = edits[0].embeds[0].data;
  assert.equal(cardData.title, "👥 Authorized operators");
  assert.equal(cardData.description, "👑 Owner: owner\n🛠 user123");
});

test("manage: list retombe sur l'ID si le membre n'est plus joignable", async () => {
  saves.length = 0;
  const {interaction, edits} = makeInteraction({
    id: "999", sub: "list", memberFor: () => null,
  });
  await manage(interaction);
  const cardData = edits[0].embeds[0].data;
  assert.equal(cardData.description, "👑 Owner: 999\n🛠 123");
});

test("manage: clear → confirmation acceptée → save([]) et carte de confirmation", async () => {
  saves.length = 0;
  const {interaction, edits} = makeInteraction({
    id: "999", sub: "clear", memberFor: () => null,
  });
  await manage(interaction);
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0], []);
  assert.equal(edits.length, 1);
  const cardData = edits[0].embeds[0].data;
  assert.equal(cardData.title, "Access reset");
  assert.equal(cardData.description, "All operator grants removed. Owner access preserved.");
});

test("manage: add d'un membre humain → save([...users, '777']) et carte done au pseudo", async () => {
  saves.length = 0;
  const {interaction, edits, fetches} = makeInteraction({
    id: "999", sub: "add", memberFor: () => ({user: {bot: false, username: "bob"}}),
  });
  await manage(interaction);
  // Validation puis re-fetch après confirmation : 2 appels ciblés.
  assert.equal(fetches.length, 2);
  assert.deepEqual(fetches, ["777", "777"]);
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0], ["123", "777"]);
  assert.equal(edits.length, 1);
  const cardData = edits[0].embeds[0].data;
  assert.equal(cardData.title, "✅ Access updated");
  assert.equal(cardData.description, "bob can now use /status, /start, /stop and /restart.");
});

test("manage: add refusé pour un bot → carte invalid, aucun save supplémentaire", async () => {
  saves.length = 0;
  const {interaction, edits, fetches} = makeInteraction({
    id: "999", sub: "add", memberFor: () => ({user: {bot: true, username: "botty"}}),
  });
  await manage(interaction);
  assert.equal(fetches.length, 1);
  assert.equal(saves.length, 0);
  assert.equal(edits.length, 1);
  const cardData = edits[0].embeds[0].data;
  assert.equal(cardData.title, "Invalid selection");
  assert.equal(cardData.description, "Choose a human member other than the owner.");
});

test("manage: remove d'un non-opérateur → carte noChange, aucun save", async () => {
  saves.length = 0;
  const {interaction, edits} = makeInteraction({
    id: "999", sub: "remove", memberFor: () => ({user: {bot: false, username: "bob"}}),
  });
  await manage(interaction);
  assert.equal(saves.length, 0);
  assert.equal(edits.length, 1);
  const cardData = edits[0].embeds[0].data;
  assert.equal(cardData.title, "No change needed");
  assert.equal(cardData.description, "This member has no operator grant.");
});

test("manage: commande en cache (option absente) → carte explicative, aucun effet", async () => {
  saves.length = 0;
  const {interaction, edits, fetches} = makeInteraction({
    id: "999", sub: "add", memberFor: () => null, stale: true,
  });
  await manage(interaction);
  assert.equal(saves.length, 0);
  assert.equal(fetches.length, 0);
  assert.equal(edits.length, 1);
  const cardData = edits[0].embeds[0].data;
  assert.equal(cardData.title, "Outdated command");
  assert.match(cardData.description, /Restart Discord/);
});

// ── Autocomplétion de l'option « membre » ─────────────────────────────────
function makeAutocomplete({sub, focused, cache, search, searchFails = false}) {
  const responses = [];
  const rosterList = cache || new Collection([
    ["777", {id: "777", user: {bot: false, username: "bob"}}],
    ["123", {id: "123", user: {bot: false, username: "user123"}}], // déjà opérateur
    ["999", {id: "999", user: {bot: false, username: "owner"}}],   // propriétaire
  ]);
  const searchResults = search || new Collection();
  const interaction = {
    commandName: "users",
    options: {getSubcommand: () => sub, getFocused: () => focused},
    respond: async (choices) => { responses.push(choices); },
    guild: {
      members: {
        cache: rosterList,
        fetch: async () => rosterList,
        search: async () => {
          if (searchFails) throw new Error("Missing Access");
          return searchResults;
        },
      },
    },
  };
  return {interaction, responses};
}

test("autocomplete: add avec champ vide → liste complète filtrée (opérateurs exclus)", async () => {
  const {interaction, responses} = makeAutocomplete({sub: "add", focused: ""});
  await handleMemberAutocomplete(interaction);
  assert.equal(responses.length, 1);
  assert.deepEqual(responses[0], [{name: "bob", value: "777"}]);
});

test("autocomplete: remove avec champ vide → uniquement les opérateurs", async () => {
  const {interaction, responses} = makeAutocomplete({sub: "remove", focused: ""});
  await handleMemberAutocomplete(interaction);
  assert.deepEqual(responses[0], [{name: "user123", value: "123"}]);
});

test("autocomplete: frappe → recherche REST de Discord, filtrée par action", async () => {
  const {interaction, responses} = makeAutocomplete({
    sub: "add", focused: "bo",
    search: new Collection([
      ["777", {id: "777", user: {bot: false, username: "bob"}}],
      ["123", {id: "123", user: {bot: false, username: "bobette"}}], // opératrice déjà
    ]),
  });
  await handleMemberAutocomplete(interaction);
  assert.deepEqual(responses[0], [{name: "bob", value: "777"}], "l'opérateur existant est écarté des résultats de recherche");
});

test("autocomplete: recherche REST indisponible → repli sur le roster filtré par préfixe", async () => {
  const {interaction, responses} = makeAutocomplete({sub: "add", focused: "BO", searchFails: true});
  await handleMemberAutocomplete(interaction);
  assert.deepEqual(responses[0], [{name: "bob", value: "777"}]);
});

test("autocomplete: aucun match → aucune suggestion", async () => {
  const {interaction, responses} = makeAutocomplete({sub: "add", focused: "zzz", searchFails: true});
  await handleMemberAutocomplete(interaction);
  assert.deepEqual(responses[0], []);
});

test("autocomplete: commande non concernée → aucune réponse", async () => {
  const {interaction, responses} = makeAutocomplete({sub: "add", focused: ""});
  interaction.commandName = "status";
  await handleMemberAutocomplete(interaction);
  assert.equal(responses.length, 0);
});
