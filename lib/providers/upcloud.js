"use strict";
// Provider UpCloud (serveurs VPS pilotés via l'API REST UpCloud 1.3).
// Doc officielle : https://developers.upcloud.com/1.3/
//
// Authentification : HTTP Basic. La variable PROVIDER_API_KEY DOIT donc
// contenir les identifiants d'un sous-compte API au format "user:password"
// (ex. "api-yorkbot:motdepasse"). La valeur est encodée en base64 et envoyée
// en en-tête `Authorization: Basic ...`.
//
// Endpoints utilisés (chapitre 8 « Servers » de la doc 1.3) :
//   GET  /1.3/server/{uuid}          → détails du serveur (champ `state`)
//   POST /1.3/server/{uuid}/start    → démarrage (corps vide accepté)
//   POST /1.3/server/{uuid}/stop     → arrêt (corps vide accepté)
//   POST /1.3/server/{uuid}/restart  → redémarrage (corps vide accepté)
//
// États `state` renvoyés par UpCloud : started, stopped, maintenance, error.
// `maintenance` et `error` sont ramenés à "unknown" : le serveur n'est alors
// ni réellement démarré ni réellement arrêté (maintenance temporaire côté
// cloud, ou erreur qui se résorbe d'elle-même d'après la doc).

const https = require("node:https");
const axios = require("axios");

// Pool de connexions partagé (https.Agent) pour limiter les handshakes TLS.
const agent = new https.Agent({keepAlive: true, maxSockets: 16});

// Actions d'alimentation acceptées par sendPowerRaw.
const POWER_ACTIONS = new Set(["start", "stop", "restart"]);

// Crée un client axios configuré pour l'API UpCloud.
// `apiKey` doit être au format "user:password" (voir en-tête du fichier).
function createClient({apiKey, apiUrl}) {
  return axios.create({
    baseURL: apiUrl || "https://api.upcloud.com",
    timeout: 15000,
    httpsAgent: agent,
    headers: {
      Authorization: `Basic ${Buffer.from(apiKey || "", "utf8").toString("base64")}`,
      Accept: "application/json",
    },
  });
}

// Récupère la réponse brute d'un serveur : GET /1.3/server/{uuid}.
// La réponse UpCloud est enveloppée : {server: {...}} (déballée par normalize).
async function fetchRaw(client, targetId) {
  return (await client.get(`/1.3/server/${targetId}`)).data;
}

// Envoie une action d'alimentation : POST /1.3/server/{uuid}/{start|stop|restart}.
// Corps vide : tous les attributs de ces endpoints sont optionnels côté UpCloud.
async function sendPowerRaw(client, targetId, action) {
  if (!POWER_ACTIONS.has(action)) {
    throw new Error(`Action d'alimentation inconnue pour UpCloud : "${action}"`);
  }
  await client.post(`/1.3/server/${targetId}/${action}`);
}

// Extrait la première adresse IP publique des `ip_addresses` brutes.
// Formes rencontrées dans la doc 1.3 :
//   {ip_addresses: {ip_address: [{access, address, family}, ...]}}  (GET détails)
//   {ip_addresses: [{access, address}, ...]}                        (réponses start/stop)
// Renvoie {ip, port: null} ou null si aucune IP publique n'est disponible.
function normalizeAddress(raw) {
  const list = Array.isArray(raw) ? raw : (raw && raw.ip_address) || null;
  if (!Array.isArray(list)) return null;
  const pub = list.find((e) => e && e.access === "public" && e.address);
  return pub ? {ip: pub.address, port: null} : null;
}

// Normalise une réponse brute vers le contrat commun (voir lib/providers/base.js).
// `state` est traduit : started → running, stopped → stopped ; maintenance,
// error et tout autre état → unknown. `raw_state` conserve l'état brut en
// minuscules. L'API 1.3 ne fournit ni métriques temps réel (CPU, RAM, disque),
// ni uptime, ni compteur de joueurs : ces champs valent null.
function normalize(raw) {
  // Accepte la réponse enveloppée {server: {...}} comme un objet serveur direct.
  const s = (raw && raw.server) || raw || {};
  const rawState = String(s.state || "unknown").toLowerCase();
  const state = rawState === "started" ? "running"
              : rawState === "stopped" ? "stopped"
              : "unknown";
  return {
    name: s.title ?? s.hostname ?? null,
    state,
    raw_state: rawState,
    cpuPct: null,
    ramMb: null,
    ramMaxMb: null,
    diskMb: null,
    diskMaxMb: null,
    uptimeSeconds: null,
    players: null,
    address: normalizeAddress(s.ip_addresses),
    node: s.zone ?? null,
  };
}

module.exports = {
  name: "upcloud",
  displayName: "UpCloud",
  kind: "vps",
  icon: "☁️",
  defaultApiUrl: "https://api.upcloud.com",
  createClient,
  fetchRaw,
  sendPowerRaw,
  normalize,
};
