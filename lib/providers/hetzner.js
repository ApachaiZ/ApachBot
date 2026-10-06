"use strict";

// Provider Hetzner Cloud (https://docs.hetzner.cloud/).
// Ne dépend que de node:https et d'axios : aucun require de config.js,
// i18n ou autre module du bot au chargement (voir contrat base.js).
//
// API utilisée :
//   GET  /servers/{id}                     → {server: {status, name, public_net, datacenter, ...}}
//   POST /servers/{id}/actions/poweron     → allumer
//   POST /servers/{id}/actions/poweroff    → éteindre
//   POST /servers/{id}/actions/reboot      → redémarrer
//   Auth : header "Authorization: Bearer <API token>".

const https = require("node:https");
const axios = require("axios");

const agent = new https.Agent({keepAlive: true, maxSockets: 16});

const DEFAULT_API_URL = "https://api.hetzner.cloud/v1";

// Mappage status Hetzner → vocabulaire commun du contrat (base.js).
// - running                          : en marche.
// - off                              : éteint.
// - starting / initializing          : démarrage en cours ; "initializing"
//   est l'état d'un serveur en cours de création, il précède "starting".
// - stopping / deleting / rebuilding : transition vers l'arrêt ; "deleting"
//   et "rebuilding" impliquent que le serveur est (ou sera) indisponible,
//   donc "stopping" est le choix raisonné le plus proche.
// Toute autre valeur → "unknown".
const STATE_MAP = {
  running: "running",
  off: "stopped",
  starting: "starting",
  initializing: "starting",
  stopping: "stopping",
  deleting: "stopping",
  rebuilding: "stopping",
};

// Action générique (contrat) → verbe d'action Hetzner.
const ACTION_MAP = {
  start: "poweron",
  stop: "poweroff",
  restart: "reboot",
};

function createClient({apiKey, apiUrl}) {
  return axios.create({
    baseURL: apiUrl || DEFAULT_API_URL,
    timeout: 15000,
    httpsAgent: agent,
    headers: {Authorization: `Bearer ${apiKey}`, Accept: "application/json"},
  });
}

async function fetchRaw(client, targetId) {
  // Réponse brute (enveloppe {server: {...}}) laissée telle quelle :
  // normalize() sait la déplier.
  return (await client.get(`/servers/${targetId}`)).data;
}

async function sendPowerRaw(client, targetId, action) {
  const verb = ACTION_MAP[action];
  if (!verb) throw new Error(`Action inconnue pour hetzner: "${action}"`);
  await client.post(`/servers/${targetId}/actions/${verb}`);
}

function normalize(raw) {
  // L'API renvoie {server: {...}} ; on accepte aussi un objet déjà déplié.
  const s = (raw && typeof raw === "object" && raw.server) || raw || {};
  const rawState = String(s.status ?? "unknown").toLowerCase();

  return {
    name: s.name ?? null,
    state: STATE_MAP[rawState] ?? "unknown",
    raw_state: rawState,
    // L'API Hetzner n'expose pas les métriques d'usage en direct
    // (CPU/RAM/disque/uptime/joueurs) : le dashboard affichera "Not reported".
    cpuPct: null,
    ramMb: null,
    ramMaxMb: null,
    diskMb: null,
    diskMaxMb: null,
    uptimeSeconds: null,
    players: null,
    // IP publique IPv4 si disponible (l'API ne fournit pas de port SSH ici).
    address: s.public_net?.ipv4?.ip ? {ip: s.public_net.ipv4.ip, port: null} : null,
    node: s.datacenter?.name ?? null,
  };
}

module.exports = {
  name: "hetzner",
  displayName: "Hetzner Cloud",
  kind: "vps",
  icon: "☁️",
  defaultApiUrl: DEFAULT_API_URL,
  createClient,
  fetchRaw,
  sendPowerRaw,
  normalize,
};
