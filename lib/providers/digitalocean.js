"use strict";

// Provider DigitalOcean (droplets) — pilotage de serveurs VPS via l'API v2.
//
// Doc officielle : https://docs.digitalocean.com/reference/api/api-reference/
// (spécification OpenAPI source : github.com/digitalocean/openapi).
//   - Authentification : header `Authorization: Bearer $DIGITALOCEAN_TOKEN`.
//   - GET  /v2/droplets/{id}          → statut du droplet (champ `status`).
//   - POST /v2/droplets/{id}/actions  → corps `{"type": "power_on"|"power_off"|"reboot"}`.
//
// Le champ `status` d'un droplet vaut "new" | "active" | "off" | "archive".
// Il est ramené ici au vocabulaire commun du contrat (voir base.js) :
//   "active" → "running", "off" → "stopped", "new" → "starting",
//   tout le reste (dont "archive" et l'absence de statut) → "unknown".
//
// L'API ne publie ni CPU %, ni RAM/disque utilisés, ni uptime, ni joueurs pour
// un droplet : ces champs sont donc toujours rendus à null (et l'embed affiche
// « Not reported » côté consommateur).

const https = require("node:https");
const axios = require("axios");

// Agent HTTPS réutilisé (keep-alive) pour limiter les handshakes TLS.
const agent = new https.Agent({keepAlive: true, maxSockets: 16});

// Traduction action YorkBot → type d'action DigitalOcean.
const POWER_ACTIONS = {
  start: "power_on",
  stop: "power_off",
  restart: "reboot",
};

// Traduction statut DigitalOcean → vocabulaire commun du contrat provider.
const STATUS_MAP = {
  active: "running",
  off: "stopped",
  new: "starting",
};

function createClient({apiKey, apiUrl}) {
  return axios.create({
    baseURL: apiUrl || "https://api.digitalocean.com",
    timeout: 15000,
    httpsAgent: agent,
    headers: {Authorization: `Bearer ${apiKey}`, Accept: "application/json"},
  });
}

// GET /v2/droplets/{id}.
// L'API répond `{droplet: {...}}` : on retourne `raw.droplet` (le droplet
// lui-même) avec un repli sur l'enveloppe entière si la clé venait à manquer,
// pour que normalize() reçoive toujours un objet de droplet.
async function fetchRaw(client, targetId) {
  const {data} = await client.get(`/v2/droplets/${targetId}`);
  return data.droplet ?? data;
}

// POST /v2/droplets/{id}/actions — action ∈ start | stop | restart.
// Toute autre valeur lève une erreur : le contrat du provider est explicite.
async function sendPowerRaw(client, targetId, action) {
  const type = POWER_ACTIONS[action];
  if (!type) {
    throw new Error(`DigitalOcean: action non supportée "${action}" (attendu : start|stop|restart)`);
  }
  await client.post(`/v2/droplets/${targetId}/actions`, {type});
}

// Normalise `raw.networks.v4` vers le contrat commun `{ip, port}` (ou null).
// On retient la première interface IPv4 publique (`type === "public"`) ; une
// interface privée seule ou l'absence de réseau renvoie null. Le port est
// toujours null : DigitalOcean ne gère pas de port d'application.
function normalizeAddress(networks) {
  const v4 = Array.isArray(networks?.v4) ? networks.v4 : [];
  const pub = v4.find((n) => n?.type === "public" && typeof n?.ip_address === "string");
  return pub ? {ip: pub.ip_address, port: null} : null;
}

function normalize(raw) {
  const rawState = String(raw?.status ?? "unknown").toLowerCase();
  const state = STATUS_MAP[rawState] ?? "unknown";
  return {
    name: raw?.name ?? null,
    state,
    raw_state: rawState,
    // Métriques non fournies par l'API droplets : toujours null.
    cpuPct: null,
    ramMb: null,
    ramMaxMb: null,
    diskMb: null,
    diskMaxMb: null,
    // Canonique `uptimeSeconds` (lu par embeds.js/watchdog.js) + alias `uptime`
    // au sens du contrat du provider : DigitalOcean n'expose aucun uptime.
    uptimeSeconds: null,
    uptime: null,
    players: null,
    address: normalizeAddress(raw?.networks),
    node: raw?.region?.slug ?? null,
  };
}

module.exports = {
  name: "digitalocean",
  displayName: "DigitalOcean",
  kind: "vps",
  icon: "🌊",
  defaultApiUrl: "https://api.digitalocean.com",
  createClient,
  fetchRaw,
  sendPowerRaw,
  normalize,
};
