"use strict";

// ═══════════════════════════════════════════════════════════════════════
// power.test.js — couverture du cœur du bot : power() (double confirmation
// et polling). Le réseau (provider) et la confirmation Discord sont remplacés
// par des mocks, et les chemins d'état (active.lock notamment) sont isolés
// vers des fichiers temporaires via un faux module paths (voir plus bas) :
// le clearLock systématique en début et fin de chaque test ne manipule donc
// que ce fichier de test, jamais .apach/active.lock.
//
// Vérification : node --test test/power.test.js
// ═══════════════════════════════════════════════════════════════════════

const assert = require("node:assert/strict");
const {test, mock} = require("node:test");

// ── Environnement factice (config réel) ────────────────────────────────
// Posé AVANT tout require de lib/ : config.js valide la présence des
// variables au chargement et i18n.js résout la langue à ce moment-là.
process.env.BOT_LANGUAGE = "en";
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";
// Figés volontairement : dotenv ne réécrit jamais une variable déjà posée.
// PROVIDER bloque la résolution du provider ; PROVIDER_SERVICES neutralisé
// garantit l'alias "default" → id "test-service", quel que soit .apach/.env.
process.env.PROVIDER = "yorkhost";
process.env.PROVIDER_SERVICES = "";

// ── Isolation des chemins d'état ───────────────────────────────────────
// state.js (verrous, users) et logger.js utilisent "./paths" : on injecte un
// faux module pointant vers des fichiers temporaires AVANT tout require de
// lib/. writeLock/clearLock/loadPersistedLock opèrent alors sur un
// active.lock de test, jamais sur le .apach/active.lock réel — le test ne
// peut plus entrer en course avec d'autres processus de test
// (watchdog.test.js) ni avec un bot en cours d'exécution.
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const tmpDir = path.join(os.tmpdir(), `apach-fake-${Date.now()}-${Math.random()}`);
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

// ── Faux confirm injecté AVANT le chargement de lib/power ──────────────
// lib/power.js déstructure {confirm} de "./confirm" au chargement : on
// remplace le module dans le cache de require pour piloter son résultat.
let confirmResult = true;
let confirmCalls = 0;
const confirmPath = require.resolve("../lib/confirm");
require.cache[confirmPath] = {
  id: confirmPath,
  filename: confirmPath,
  loaded: true,
  exports: {
    confirm: async () => {
      confirmCalls++;
      return confirmResult;
    },
  },
  children: [],
  paths: [],
};

// ── Chargement du code sous test (après l'injection) ───────────────────
const {power} = require("../lib/power");
const {clearLock, writeLock, loadPersistedLock} = require("../lib/state");
const {clearCache} = require("../lib/api");
const yh = require("../lib/providers/yorkhost");
const {t} = require("../lib/i18n");
const {cfg} = require("../lib/config");

const SERVICE_ID = "test-service"; // cfg.service_id pour l'alias "default"

// mock.timers n'existe qu'à partir de Node 20.4 : les cas de polling sont
// ignorés (skip) sur les versions antérieures plutôt que d'attendre 5 s
// par itération.
const hasMockTimers = typeof mock?.timers?.enable === "function";

// ── Mocks réseau (même objet provider que lib/api.js utilise) ──────────
let rawState = "online"; // état constant utilisé quand rawQueue est absente
let rawQueue = null;     // file optionnelle de réponses brutes (une par appel)
let onPower = null;      // effet de bord optionnel de sendPowerRaw
let failPower = null;    // si posé, sendPowerRaw lève cette erreur (timeout, 5xx…)
let powerCalls = [];     // journal {id, action} des appels power

const originalFetchRaw = yh.fetchRaw;
const originalSendPowerRaw = yh.sendPowerRaw;

// Réponse brute suivante : file si présente (dernier élément répété à
// l'infini une fois la file épuisée), sinon état constant piloté par rawState.
function sample() {
  if (rawQueue) return rawQueue.length ? rawQueue.shift() : rawQueue[rawQueue.length - 1];
  return {name: "srv", state: rawState, cpuPct: 10, uptimeSeconds: rawState === "online" ? 10000 : 0};
}

function installProviderMocks() {
  yh.fetchRaw = async () => sample();
  yh.sendPowerRaw = async (client, id, action) => {
    powerCalls.push({id, action});
    if (failPower) {
      const e = new Error(failPower.message || "send failed");
      if (failPower.code) e.code = failPower.code;
      throw e;
    }
    if (onPower) onPower(action);
  };
}

// Les patches sont globaux au processus : on restaure les originaux à la
// fin de chaque test et on les repose au début du suivant.
function uninstallProviderMocks() {
  yh.fetchRaw = originalFetchRaw;
  yh.sendPowerRaw = originalSendPowerRaw;
}

// Remise à zéro de tout l'état pilotable + purge du cache API (TTL 5 s)
// + purge du verrou : chaque test démarre d'un état propre.
function resetState() {
  rawState = "online";
  rawQueue = null;
  onPower = null;
  failPower = null;
  powerCalls = [];
  confirmResult = true;
  confirmCalls = 0;
  clearCache();
  clearLock("default");
}

// Interaction minimale : power n'attend jamais de valeur de retour
// d'editReply (le confirm est fake), on capture simplement les payloads.
function makeInteraction(userId) {
  const captures = [];
  return {
    captures,
    interaction: {
      user: {id: userId},
      editReply: async (payload) => { captures.push(payload); },
    },
  };
}

// Dernier embed envoyé par power (la carte finale, résultat de l'action).
function lastEmbed(i) {
  assert.ok(i.captures.length > 0, "power doit avoir envoyé au moins une carte");
  return i.captures[i.captures.length - 1].embeds[0].data;
}

// Lance power sans await puis pilote l'horloge mockée jusqu'à résolution.
// Le flush des microtâches après chaque tick laisse les continuations async
// (get, sleep suivant…) s'exécuter avant le tick suivant.
async function drive(p, {stepMs, maxTicks}) {
  let settled = false;
  p.then(() => { settled = true; }, () => { settled = true; });
  for (let k = 0; k < maxTicks && !settled; k++) {
    await mock.timers.tick(stepMs);
    await Promise.resolve();
  }
  if (!settled) assert.fail(`power ne s'est pas résolue après ${maxTicks} ticks de ${stepMs} ms`);
  await p;
}

// ═══════════════════════════════════════════════════════════════════════
// Cas rapides — sans mock timers (pas de polling déclenché)
// ═══════════════════════════════════════════════════════════════════════

test("power: accès refusé pour un utilisateur non autorisé", async () => {
  resetState();
  installProviderMocks();
  try {
    // "888888" n'est ni le propriétaire (env "999") ni présent dans users.json.
    const {interaction, captures} = makeInteraction("888888");
    await power(interaction, "start", undefined);
    assert.equal(confirmCalls, 0, "aucune confirmation demandée");
    assert.equal(powerCalls.length, 0, "aucun appel power réseau");
    assert.equal(loadPersistedLock().default, undefined, "aucun verrou posé");
    assert.equal(captures.length, 1, "une seule carte (accessDenied)");
    const e = captures[0].embeds[0].data;
    assert.equal(e.title, t("power.accessDenied").title);
    assert.equal(e.description, t("power.accessDenied").body);
  } finally {
    clearLock("default");
    uninstallProviderMocks();
  }
});

test("power: action déjà en cours (verrou existant)", async () => {
  resetState();
  installProviderMocks();
  try {
    writeLock("default", "start"); // verrou posé AVANT l'appel
    const {interaction, captures} = makeInteraction("999");
    await power(interaction, "start", undefined);
    assert.equal(confirmCalls, 0, "aucune confirmation demandée");
    assert.equal(powerCalls.length, 0, "aucun sendPower envoyé");
    assert.equal(captures.length, 1);
    const e = captures[0].embeds[0].data;
    assert.equal(e.title, t("power.actionInProgress").title);
    // NB : t() n'interpole pas à l'intérieur des objets {title, body},
    // power envoie donc le body brut avec ses placeholders — on rejoue
    // exactement le même appel pour rester aligné sur le comportement réel.
    assert.equal(e.description, t("power.actionInProgress", {action: "start", alias: "default"}).body);
  } finally {
    clearLock("default");
    uninstallProviderMocks();
  }
});

test("power: confirmation refusée — aucun effet", async () => {
  resetState();
  installProviderMocks();
  confirmResult = false;
  try {
    const {interaction, captures} = makeInteraction("999");
    await power(interaction, "start", undefined);
    assert.equal(confirmCalls, 1, "confirm demandé exactement une fois");
    assert.equal(captures.length, 0, "aucune carte envoyée par power");
    assert.equal(powerCalls.length, 0, "aucun sendPower");
    assert.equal(loadPersistedLock().default, undefined, "aucun verrou écrit");
  } finally {
    clearLock("default");
    uninstallProviderMocks();
  }
});

test("power: déjà dans l'état cible (start alors que online)", async () => {
  resetState();
  installProviderMocks();
  try {
    const {interaction, captures} = makeInteraction("999");
    await power(interaction, "start", undefined);
    assert.equal(powerCalls.length, 0, "aucun sendPower envoyé");
    assert.equal(captures.length, 1, "une seule carte (alreadyInTargetState)");
    const e = captures[0].embeds[0].data;
    assert.equal(e.title, t("power.alreadyInTargetState").title);
    // "online" est normalisé en "running" par le provider (voir normalize).
    assert.equal(e.description, t("power.alreadyInTargetState", {state: "running"}).body);
    assert.equal(loadPersistedLock().default, undefined, "verrou nettoyé par le finally de power");
  } finally {
    clearLock("default");
    uninstallProviderMocks();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Cas avec mock timers — le polling dort 5 s par itération, l'horloge
// mockée les rend instantanés.
// ═══════════════════════════════════════════════════════════════════════

test("power: stop aboutit (2 états offline consécutifs)", {skip: !hasMockTimers}, async () => {
  resetState();
  installProviderMocks();
  onPower = () => { rawState = "offline"; }; // le POST bascule l'état observé
  mock.timers.enable({apis: ["setTimeout"]});
  try {
    const m = makeInteraction("999");
    const p = power(m.interaction, "stop", undefined); // SANS await : on pilote l'horloge
    // Budget généreux : chaque tick n'avance qu'environ une étape async de la
    // chaîne (confirm → get → sendPower → editReply → sleep → …), constaté
    // empiriquement sous node:test. 100 ticks de 5 s suffisent largement
    // (stop = 2 polls), le temps réel reste de l'ordre de quelques ms.
    await drive(p, {stepMs: 5000, maxTicks: 100});
    assert.deepEqual(powerCalls, [{id: SERVICE_ID, action: "stop"}]);
    assert.equal(m.captures.length, 2, "cartes « accepted » puis « completed »");
    const e = lastEmbed(m);
    assert.equal(e.title, t("power.completed").title);
    assert.match(e.description, /STOP/);
    assert.match(e.description, new RegExp(`confirmed by ${cfg.provider_label}`));
    // Pas d'assertion sur les secondes exactes : Date n'est pas mocké ici,
    // l'horloge réelle n'a presque pas avancé.
    assert.equal(loadPersistedLock().default, undefined, "verrou nettoyé");
  } finally {
    mock.timers.reset();
    clearLock("default");
    uninstallProviderMocks();
  }
});

test("power: restart détecte la remise à zéro d'uptime", {skip: !hasMockTimers}, async () => {
  resetState();
  installProviderMocks();
  // File de réponses brutes : before (online 10000) → offline (transition)
  // → online 500 (reset détecté, stable 1) → online 600 (stable 2 → completed).
  rawQueue = [
    {state: "online", uptimeSeconds: 10000},
    {state: "offline", uptimeSeconds: 0},
    {state: "online", uptimeSeconds: 500},
    {state: "online", uptimeSeconds: 600},
    {state: "online", uptimeSeconds: 700}, // jamais atteint
  ];
  mock.timers.enable({apis: ["setTimeout"]});
  try {
    const m = makeInteraction("999");
    const p = power(m.interaction, "restart", undefined);
    await drive(p, {stepMs: 5000, maxTicks: 100});
    assert.deepEqual(powerCalls, [{id: SERVICE_ID, action: "restart"}]);
    assert.equal(m.captures.length, 2, "cartes « accepted » puis « completed »");
    const e = lastEmbed(m);
    assert.equal(e.title, t("power.completed").title);
    assert.match(e.description, /RESTART/);
    assert.match(e.description, /joinable/, "mention tail de completed présente (action ≠ stop)");
    assert.equal(loadPersistedLock().default, undefined, "verrou nettoyé");
  } finally {
    mock.timers.reset();
    clearLock("default");
    uninstallProviderMocks();
  }
});

// Cas optionnel : timeout de 10 minutes sans confirmation d'état.
// Nécessite la moquerie de Date (la boucle compare Date.now() à son départ).
// Si ce cas s'avérait instable avec le runner node:test, il suffirait de le
// supprimer — les cas 1 à 6 couvrent déjà l'essentiel du contrat.
test("power: timeout sans confirmation d'état (10 minutes virtuelles)", {skip: !hasMockTimers}, async () => {
  resetState();
  installProviderMocks();
  rawState = "offline"; // reste offline : "start" n'aboutira jamais
  mock.timers.enable({apis: ["setTimeout", "Date"]});
  try {
    const m = makeInteraction("999");
    const p = power(m.interaction, "start", undefined);
    // 30 ticks × 30 000 ms = 900 000 ms virtuels > 600 000 ms de timeout.
    await drive(p, {stepMs: 30000, maxTicks: 30});
    assert.deepEqual(powerCalls, [{id: SERVICE_ID, action: "start"}]);
    assert.equal(m.captures.length, 2, "cartes « accepted » puis « notConfirmed »");
    const e = lastEmbed(m);
    assert.equal(e.title, t("power.notConfirmed").title);
    assert.match(e.description, /10 minutes/);
    assert.equal(loadPersistedLock().default, undefined, "verrou nettoyé");
  } finally {
    mock.timers.reset();
    clearLock("default");
    uninstallProviderMocks();
  }
});

// ── Échec de transmission : l'action a pu être exécutée côté provider ──
test("power: sendPower en erreur mais état cible vérifié → carte « appliedDespiteError », pas d'erreur", async () => {
  resetState();
  installProviderMocks();
  failPower = {message: "timeout", code: "ECONNABORTED"};
  // before : online → le POST « échoue » (timeout) → vérification : offline (stop atteint).
  rawQueue = [
    {state: "online", uptimeSeconds: 10000},
    {state: "offline", uptimeSeconds: 0},
  ];
  try {
    const m = makeInteraction("999");
    await power(m.interaction, "stop", undefined);
    assert.deepEqual(powerCalls, [{id: SERVICE_ID, action: "stop"}], "un seul POST, aucun retry");
    assert.equal(m.captures.length, 1, "une seule carte (appliedDespiteError)");
    const e = lastEmbed(m);
    assert.equal(e.title, t("power.appliedDespiteError").title);
    assert.match(e.description, /\*\*stopped\*\*/);
    assert.match(e.description, new RegExp(cfg.provider_label), "provider cité");
    assert.match(e.description, /No new power request was sent/);
    assert.equal(loadPersistedLock().default, undefined, "verrou nettoyé");
  } finally {
    clearLock("default");
    uninstallProviderMocks();
  }
});

test("power: sendPower en erreur et état jamais atteint → erreur relancée avec _powerSent", {skip: !hasMockTimers}, async () => {
  resetState();
  installProviderMocks();
  failPower = {message: "timeout", code: "ECONNABORTED"};
  rawState = "online"; // reste online : « stop » n'atteindra jamais offline
  mock.timers.enable({apis: ["setTimeout"]});
  try {
    const m = makeInteraction("999");
    let caught = null;
    const p = power(m.interaction, "stop", undefined).catch((e) => { caught = e; });
    // 3 tentatives de vérification : immédiate + 2 × 5 s = 10 s virtuelles.
    await drive(p, {stepMs: 5000, maxTicks: 60});
    assert.ok(caught, "power doit relancer l'erreur");
    assert.equal(caught._powerSent, true, "marqueur _powerSent posé pour errorText");
    assert.equal(caught.code, "ECONNABORTED");
    assert.equal(m.captures.length, 0, "aucune carte envoyée par power (l'affichage est géré par interaction)");
    assert.deepEqual(powerCalls, [{id: SERVICE_ID, action: "stop"}], "un seul POST, aucun retry");
    assert.equal(loadPersistedLock().default, undefined, "verrou nettoyé");
  } finally {
    mock.timers.reset();
    clearLock("default");
    uninstallProviderMocks();
  }
});
