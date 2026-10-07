"use strict";
const fs = require("node:fs");
const {membersStateFile, membersRosterFile} = require("./paths");
const {readJson, writeJson} = require("./crypto");
const logger = require("./logger");

// Discord rate-limite sévèrement REQUEST_GUILD_MEMBERS (opcode 8 gateway) :
// « request with opcode 8 was rate limited » — environ 1 chargement complet
// par guilde toutes les 10 minutes. Ce module centralise la politique :
// - le menu /users est servi depuis le CACHE en mémoire, ou à défaut depuis
//   la LISTE PERSISTÉE (members.roster.json) : les données d'un chargement
//   précédent survivent aux redémarrages du bot et au quota épuisé ;
// - un rechargement complet n'a lieu que si le cache est vide ET que le
//   dernier chargement réussi date d'avant le cooldown — jeton de date
//   persisté (members.state.json), qui survit lui aussi aux redémarrages.
const COOLDOWN_MS = 10 * 60_000;
// Une liste persistée plus vieille que ça n'est plus proposée (membres
// partis/rejoints trop incertains).
const ROSTER_MAX_AGE_MS = 24 * 60 * 60_000;

// Lecture directe à chaque appel (rare) : l'état disque est la seule source
// de vérité — les tests et les redémarrages restent prévisibles.
function readState() {
  try { return JSON.parse(fs.readFileSync(membersStateFile, "utf8")) || {}; }
  catch { return {}; }
}

function writeState(state) {
  try { fs.writeFileSync(membersStateFile, JSON.stringify(state)); }
  catch (err) { logger.warn(`members: impossible d'écrire ${membersStateFile} : ${err.message}`); }
}

function lastFetchAt() {
  const v = Number(readState().fetchedAt);
  return Number.isFinite(v) ? v : 0;
}

// Écrit la liste persistée depuis le cache (humains uniquement, triés).
// Chiffrée : la liste des membres ne doit pas être lisible en clair sur le
// disque.
function persistRoster(guild) {
  const members = guild.members.cache
    .filter((m) => !m.user.bot)
    .map((m) => ({id: m.id, username: m.user.username}))
    .sort((a, b) => a.username.localeCompare(b.username, undefined, {sensitivity: "base"}));
  try { writeJson(membersRosterFile, {savedAt: Date.now(), members}); }
  catch (err) { logger.warn(`members: impossible d'écrire ${membersRosterFile} : ${err.message}`); }
  return members;
}

// Liste persistée exploitable, ou [] si absente ou trop vieille.
// Lecture tolérante : chiffré ou clair hérité.
function readPersistedRoster() {
  const data = readJson(membersRosterFile);
  if (!data) return [];
  const savedAt = Number(data.savedAt) || 0;
  const members = Array.isArray(data.members) ? data.members : [];
  if (!members.length) return [];
  if (Date.now() - savedAt > ROSTER_MAX_AGE_MS) return [];
  return members;
}

// Remplit le cache de membres de la guilde en respectant le cooldown Discord.
// Retourne true si un chargement complet a réussi, false sinon. Quand le
// cache est déjà chaud, la liste persistée est rafraîchie gratuitement.
async function refreshMembers(guild) {
  if (guild.members.cache.size > 0) {
    persistRoster(guild);
    return false;
  }
  if (Date.now() - lastFetchAt() < COOLDOWN_MS) return false; // cooldown
  try {
    await guild.members.fetch();
    persistRoster(guild);
    writeState({fetchedAt: Date.now()});
    logger.info(`members: ${guild.members.cache.size} membres en cache.`);
    return true;
  } catch (err) {
    logger.warn(`members: chargement complet impossible (rate-limit opcode 8 ?) : ${err.message}`);
    return false;
  }
}

module.exports = {refreshMembers, readPersistedRoster};
