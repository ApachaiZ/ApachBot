"use strict";

// Tests unitaires de lib/ping.js.
//
// L'environnement factice doit être posé AVANT tout require du bot : config.js
// (chargé transitivement via lib/ping.js → lib/api.js) valide ces variables au
// chargement. Deux services permettent de vérifier la résolution d'alias,
// "main" étant le service par défaut.
process.env.BOT_LANGUAGE = "en";
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICES) process.env.PROVIDER_SERVICES = "main=svc-a,backup=svc-b";

const {test, beforeEach, afterEach} = require("node:test");
const assert = require("node:assert/strict");

const {ping} = require("../lib/ping");

// lib/api.js appelle `provider.fetchRaw(client, id)` où `provider` provient de
// lib/config.js. `validate()` (lib/providers/base.js) renvoie le module tel
// quel, donc config et ce require partagent le même objet : patcher
// yh.fetchRaw coupe bien le réseau, aucun appel HTTP réel.
const yh = require("../lib/providers/yorkhost");
const origFetchRaw = yh.fetchRaw;

// Identifiants de service reçus par le faux réseau, dans l'ordre des appels.
const seenIds = [];

// Interaction minimale : ping() n'utilise que i.editReply (ni options ni user).
// L'EmbedBuilder (lib/embeds.js) est capturé tel quel, les assertions lisent
// payload.embeds[0].data.title / .data.description.
function mockInteraction() {
  let captured = null;
  const i = {editReply: async (p) => { captured = p; }};
  return {i, captured: () => captured};
}

// Le faux réseau par défaut renvoie un état "online" (normalisé en "running").
// Chaque test peut le remplacer par une version qui throw ; afterEach restaure
// l'original pour éviter toute fuite entre tests.
beforeEach(() => {
  seenIds.length = 0;
  yh.fetchRaw = async (client, id) => {
    seenIds.push(id);
    return {name: "srv", state: "online"};
  };
});

afterEach(() => {
  yh.fetchRaw = origFetchRaw;
});

// Chaînes exactes de lib/locales/en.js (clés ping.*), copiées ici pour
// comparer les cartes au mot près :
//   ping.pong.title            → "🏓 Pong"
//   ping.pong.body             → "Service **{alias}** responded in **{ms} ms**."
//   ping.failed.title          → "🏓 Ping failed"
//   ping.failed.body           → "Service **{alias}** unreachable{statusPart}.\nCheck your API key and service ID."
//   ping.failed.statusSuffix   → " (HTTP {status})"
const PONG_TITLE = "🏓 Pong";
const FAILED_TITLE = "🏓 Ping failed";
const FAILED_BODY = "Service **backup** unreachable{statusPart}.\nCheck your API key and service ID.";

test("ping: alias explicite résout le bon ID et renvoie la carte pong", async () => {
  const {i, captured} = mockInteraction();

  await ping(i, "backup");

  // L'alias "backup" doit être résolu en ID "svc-b" côté réseau.
  assert.deepEqual(seenIds, ["svc-b"]);

  const embed = captured().embeds[0].data;
  // Titre exact de la locale en (clé ping.pong.title).
  assert.equal(embed.title, PONG_TITLE);
  // Description : alias "backup" + latence en millisecondes ; le "tone" de la
  // carte dépend du temps réel, on ne l'asserte pas.
  assert.match(embed.description, /backup/);
  assert.match(embed.description, /\d+ ms/);
  assert.match(embed.description, /^Service \*\*backup\*\* responded in \*\*\d+ ms\*\*\.$/);
});

test("ping: alias absent utilise le service par défaut", async () => {
  const {i, captured} = mockInteraction();

  await ping(i, undefined);

  // Sans alias, resolveService retombe sur le premier alias configuré ("main").
  assert.deepEqual(seenIds, ["svc-a"]);

  const embed = captured().embeds[0].data;
  assert.equal(embed.title, PONG_TITLE);
  assert.match(embed.description, /main/);
});

test("ping: alias inconnu rejette avec Unknown service", async () => {
  const {i} = mockInteraction();

  // resolveService lève avant tout appel réseau : seenIds reste vide.
  await assert.rejects(ping(i, "nope"), /Unknown service/);
  assert.deepEqual(seenIds, []);
});

test("ping: échec HTTP renseigne le statut dans la carte failed", async () => {
  const {i, captured} = mockInteraction();

  // Erreur avec response.status (cas typique d'un statut HTTP d'erreur).
  yh.fetchRaw = async () => {
    throw Object.assign(new Error("http"), {response: {status: 503}});
  };

  await ping(i, "backup");

  const embed = captured().embeds[0].data;
  // Titre exact de la locale en (clé ping.failed.title).
  assert.equal(embed.title, FAILED_TITLE);
  // Corps exact avec le suffixe " (HTTP 503)" interpolé (clés ping.failed.body
  // + ping.failed.statusSuffix).
  assert.equal(embed.description, FAILED_BODY.replace("{statusPart}", " (HTTP 503)"));
  assert.ok(embed.description.includes("503"));
});

test("ping: échec réseau sans statut omet le suffixe HTTP", async () => {
  const {i, captured} = mockInteraction();

  // Erreur sans propriété `response` (panne réseau, timeout, etc.).
  yh.fetchRaw = async () => {
    throw new Error("network down");
  };

  await ping(i, "backup");

  const embed = captured().embeds[0].data;
  assert.equal(embed.title, FAILED_TITLE);
  // Corps exact sans suffixe de statut : aucune mention de "HTTP".
  assert.equal(embed.description, FAILED_BODY.replace("{statusPart}", ""));
  assert.ok(!embed.description.includes("HTTP"));
});
