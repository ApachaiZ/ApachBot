"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

// ── Faux modules injectés AVANT tout require de manage ─────────────────────
// lib/manage.js déstructure {isOwner, getUsers, save} de "./state" et
// {confirm} de "./confirm" au chargement : on ne peut pas les patcher après
// coup. On remplace donc les entrées du cache require par des faux modules.
function fakeModule(relPath, exports) {
  const filename = require.resolve(relPath);
  require.cache[filename] = {id: filename, filename, loaded: true, exports, children: [], paths: []};
}

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

const {manage} = require("../lib/manage");

// ── Fabrique d'interaction factice ─────────────────────────────────────────
// editReply capture le payload (pour les assertions) et renvoie un message
// dont awaitMessageComponent simule la sélection du membre "777" par
// l'auteur de la commande, à condition que le filtre (auteur + customId du
// UserSelectMenu) passe. guild.members.fetch renvoie `memberFor(targetId)` à
// chaque appel : le flux "add" re-fetch le membre après confirmation.
function makeInteraction({id, sub, memberFor}) {
  const edits = [];
  const followUps = [];
  const fetches = [];
  const interaction = {
    user: {id},
    options: {getSubcommand: () => sub},
    editReply: async (p) => {
      edits.push(p);
      // customId du sélecteur (présent uniquement pour add/remove).
      const customId = p.components?.[0]?.components?.[0]?.data?.custom_id;
      return {
        awaitMessageComponent: async ({time, filter}) => {
          const click = {values: ["777"], deferUpdate: async () => {}};
          const full = {...click, user: {id}, customId};
          if (!filter(full)) throw new Error("timeout");
          return full;
        },
      };
    },
    followUp: async (p) => { followUps.push(p); },
    guild: {
      members: {
        fetch: async (targetId) => {
          fetches.push(targetId);
          return memberFor(targetId);
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

test("manage: list avec un seul utilisateur → une seule page (editReply 1×, followUp 0×)", async () => {
  saves.length = 0;
  const {interaction, edits, followUps} = makeInteraction({
    id: "999", sub: "list", memberFor: () => null,
  });
  await manage(interaction);
  assert.equal(edits.length, 1);
  assert.equal(followUps.length, 0);
  const cardData = edits[0].embeds[0].data;
  assert.equal(cardData.title, "👥 Authorized operators");
  assert.equal(cardData.description, "👑 Owner: <@999>\n🛠 <@123> • 123");
  assert.ok(cardData.description.includes("<@999>"), "le corps mentionne l'ownerId");
  assert.ok(cardData.description.includes("123"), "le corps liste l'utilisateur 123");
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

test("manage: add d'un membre humain → save([...users, '777']) et carte done", async () => {
  saves.length = 0;
  const {interaction, edits, fetches} = makeInteraction({
    id: "999", sub: "add", memberFor: () => ({user: {bot: false, username: "bob"}}),
  });
  await manage(interaction);
  // Le membre est re-fetché après la confirmation : 2 appels au total.
  assert.equal(fetches.length, 2);
  assert.deepEqual(fetches, ["777", "777"]);
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0], ["123", "777"]);
  assert.equal(edits.length, 2);
  const cardData = edits[1].embeds[0].data;
  assert.equal(cardData.title, "✅ Access updated");
  assert.equal(cardData.description, "<@777> can now use /status, /start, /stop and /restart.");
});

test("manage: add refusé pour un bot → carte invalid, aucun save supplémentaire", async () => {
  saves.length = 0;
  const {interaction, edits, fetches} = makeInteraction({
    id: "999", sub: "add", memberFor: () => ({user: {bot: true, username: "botty"}}),
  });
  await manage(interaction);
  assert.equal(fetches.length, 1);
  assert.equal(saves.length, 0);
  assert.equal(edits.length, 2);
  const cardData = edits[1].embeds[0].data;
  assert.equal(cardData.title, "Invalid selection");
  assert.equal(cardData.description, "Choose a human member other than the owner.");
});

test("manage: remove d'un utilisateur sans accès → carte noChange, aucun save", async () => {
  saves.length = 0;
  const {interaction, edits} = makeInteraction({
    id: "999", sub: "remove", memberFor: () => ({user: {bot: false, username: "bob"}}),
  });
  await manage(interaction);
  assert.equal(saves.length, 0);
  assert.equal(edits.length, 2);
  const cardData = edits[1].embeds[0].data;
  assert.equal(cardData.title, "No change needed");
  assert.equal(cardData.description, "This member has no operator grant.");
});
