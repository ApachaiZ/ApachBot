"use strict";
// Provider Nitrado — https://api.nitrado.net
// Doc officielle : https://doc.nitrado.net/ (« NitrAPI Documentation », apiDoc,
// v1.0.0, générée 2026-09-29 ; données : doc.nitrado.net/api_data.json).
//
// AUTH : OAuth2 Bearer. Côté Nitrado : POST /oauth/v2/token (access token ≈ 1 jour,
// refresh token ≈ 1 mois) ou POST /token/long_life_token (token « valid for many
// years »). On reçoit donc ici un token long-lived, passé en en-tête
// `Authorization: Bearer <apiKey>` avec `Accept: application/json`
// (la doc accepte aussi ?access_token= en GET, non utilisé ici).
//
// CHOIX DE L'ID : `targetId` doit être l'ID DU SERVICE Nitrado (le « Service ID »
// du webinterface), PAS l'id interne du gameserver. GET /services/{id}/gameservers
// renvoie directement l'objet `data.gameserver` : cet endpoint sert à la fois de
// liste et de détail, un seul appel suffit — aucune résolution préalable de l'id
// du gameserver (si une version de l'API exigeait un id de gameserver, il
// faudrait deux appels : liste puis détail ; non nécessaire ici).
//
// ÉCARTS AVEC LA FORME « /gameservers/gameserver » (documentés) : la doc actuelle
// n'expose NI GET /services/{id}/gameservers/gameserver, NI POST .../gameserver/restart.
// Les actions réelles sont :
//   restart → POST /services/{id}/gameservers/restart
//   stop    → POST /services/{id}/gameservers/stop
//   start   → POST /services/{id}/gameservers/games/start (paramètre requis
//             `game` = identifiant court du jeu, ex. « minecraft », résolu
//             depuis le détail → deux appels pour start).
const https = require("node:https");
const axios = require("axios");

const agent = new https.Agent({keepAlive: true, maxSockets: 16});

// Statuts documentés de `data.gameserver.status` : started, stopped, stopping,
// restarting, suspended, guardian_locked, gs_installation, backup_restore,
// backup_creation, chunkfix.
// → vocabulaire commun du contrat (base.js) :
//   started   → running
//   stopped   → stopped
//   suspended → stopped  (service suspendu, à réactiver depuis le site)
//   stopping  → stopping
//   starting  → starting (accepté par prudence ; absent de la table officielle)
//   les autres (restarting, guardian_locked, backup_*, chunkfix…) n'ont pas
//   d'équivalent dans le vocabulaire commun → "unknown" ; le statut brut exact
//   reste disponible dans raw_state (minuscules).
const STATUS_MAP = new Map([
  ["started", "running"],
  ["stopped", "stopped"],
  ["suspended", "stopped"],
  ["starting", "starting"],
  ["stopping", "stopping"],
]);

const POWER_ACTIONS = new Set(["start", "stop", "restart"]);

function createClient({apiKey, apiUrl}) {
  return axios.create({
    baseURL: apiUrl || "https://api.nitrado.net",
    timeout: 15000,
    httpsAgent: agent,
    headers: {Authorization: `Bearer ${apiKey}`, Accept: "application/json"},
  });
}

// Détail du gameserver : GET /services/{targetId}/gameservers.
// Renvoie le corps complet {status, data: {gameserver: {...}}} ; `normalize`
// en extrait les champs utiles.
async function fetchRaw(client, targetId) {
  const res = await client.get(`/services/${targetId}/gameservers`);
  return res.data;
}

// Actions d'alimentation (start|stop|restart) — voir en-tête du fichier pour les
// URLs exactes et l'écart documenté pour start (deux appels : détail puis
// POST /games/start avec le paramètre `game`).
async function sendPowerRaw(client, targetId, action) {
  if (!POWER_ACTIONS.has(action)) {
    throw new Error(`Action inconnue pour le provider nitrado : "${action}" (start|stop|restart)`);
  }
  if (action === "restart") {
    await client.post(`/services/${targetId}/gameservers/restart`);
    return;
  }
  if (action === "stop") {
    await client.post(`/services/${targetId}/gameservers/stop`);
    return;
  }
  // start : l'API ne propose pas de start direct sur le gameserver ; le démarrage
  // passe par POST /services/{id}/gameservers/games/start qui exige `game`
  // (identifiant court du jeu). On le lit depuis le détail (2e appel documenté).
  const {data} = await client.get(`/services/${targetId}/gameservers`);
  const game = data && data.gameserver ? data.gameserver.game : null;
  if (!game) {
    throw new Error("Provider nitrado : impossible de démarrer — le détail ne fournit pas le champ `game` requis par POST /games/start.");
  }
  await client.post(`/services/${targetId}/gameservers/games/start`, {game});
}

// Dernier point d'une série de stats Nitrado : tableaux de paires [valeur, timestamp].
function lastPoint(series) {
  return Array.isArray(series) && series.length > 0 ? series[series.length - 1] : null;
}

function toNumber(v) {
  return v == null || v === "" ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
}

// Adresse de connexion. Le détail documenté expose `query.connect_ip` au format
// "ip:port" (et `ip`/`port` à la racine du gameserver). Les champs
// query.server_ip / query.server_port sont acceptés par défense (anciennes
// versions d'API). Normalisation vers le contrat {ip, port} (ou null).
function normalizeAddress(gs) {
  const query = gs.query && typeof gs.query === "object" ? gs.query : {};
  if (query.server_ip != null || query.server_port != null) {
    return {ip: query.server_ip ?? null, port: toNumber(query.server_port)};
  }
  if (typeof query.connect_ip === "string" && query.connect_ip !== "") {
    const idx = query.connect_ip.lastIndexOf(":");
    if (idx <= 0) return {ip: query.connect_ip, port: null};
    return {ip: query.connect_ip.slice(0, idx), port: toNumber(query.connect_ip.slice(idx + 1))};
  }
  if (gs.ip != null || gs.port != null) {
    return {ip: gs.ip ?? null, port: toNumber(gs.port)};
  }
  return null;
}

// Normalise le corps d'une réponse Nitrado vers l'objet canonique du contrat.
// `raw` = retour de fetchRaw : {status, data: {gameserver: {...}}}.
// cpuPct/ramMb n'existent pas dans le détail : ils viennent de l'endpoint séparé
// GET /services/{id}/gameservers/stats (paramètre `hours`, défaut 24). Si ce
// payload est fourni dans raw.data.stats (séries cpuUsage / memoryUsage /
// currentPlayers au format [valeur, timestamp_unix]), on retient le dernier
// point de chaque série ; sinon null (le contrat autorise « non rapporté »).
// Unités de la doc : cpuUsage en %, memoryUsage en Mo (exemple officiel 346.0).
// players vient de query.player_current (si présent), sinon du dernier point
// de currentPlayers.
function normalize(raw) {
  const body = raw && typeof raw === "object" ? raw : {};
  const data = body.data && typeof body.data === "object" ? body.data : {};
  const gs = data.gameserver && typeof data.gameserver === "object" ? data.gameserver : {};
  const query = gs.query && typeof gs.query === "object" ? gs.query : {};

  const rawState = String(gs.status || "unknown").toLowerCase();
  const state = STATUS_MAP.get(rawState) || "unknown";

  let cpuPct = null;
  let ramMb = null;
  let players = toNumber(query.player_current);
  if (data.stats && typeof data.stats === "object") {
    const cpu = lastPoint(data.stats.cpuUsage);
    const ram = lastPoint(data.stats.memoryUsage);
    const player = lastPoint(data.stats.currentPlayers);
    if (Array.isArray(cpu) && cpu.length > 0) cpuPct = toNumber(cpu[0]);
    if (Array.isArray(ram) && ram.length > 0) ramMb = toNumber(ram[0]);
    if (players == null && Array.isArray(player) && player.length > 0) players = toNumber(player[0]);
  }

  return {
    name: query.server_name != null ? query.server_name : null,
    state,
    raw_state: rawState,
    cpuPct,
    ramMb,
    ramMaxMb: null,      // non exposé par l'API Nitrado
    diskMb: null,        // non exposé
    diskMaxMb: null,     // non exposé
    uptimeSeconds: null, // non exposé sous forme directe
    players,
    address: normalizeAddress(gs),
    node: gs.location_id != null ? gs.location_id : null,
  };
}

module.exports = {
  name: "nitrado",
  displayName: "Nitrado",
  kind: "game",
  icon: "🎮",
  defaultApiUrl: "https://api.nitrado.net",
  createClient,
  fetchRaw,
  sendPowerRaw,
  normalize,
};
