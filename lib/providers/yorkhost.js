"use strict";
const https = require("node:https");
const axios = require("axios");

const agent = new https.Agent({keepAlive: true, maxSockets: 16});

// Délais distincts, constatés en production (logs PM2) :
// - les lectures (état, métriques) répondent vite, mais peuvent dépasser 15 s
//   pendant le boot d'un serveur de jeu → 30 s pour calmer le watchdog ;
// - le POST /power « stop » ne répond qu'une fois l'arrêt COMPLET du jeu
//   effectué (ApaWorld/Zomboid > 15 s) : avec 15 s il expirait quasi
//   systématiquement alors que l'arrêt réussissait → 120 s. Le start répond
//   immédiatement. En cas de dépassement, power.js bascule sur la vérification
//   d'état sans jamais renvoyer de requête power.
const GET_TIMEOUT_MS = 30_000;
const POWER_TIMEOUT_MS = 120_000;

const ONLINE = new Set(["running", "online"]);
const OFFLINE = new Set(["offline", "stopped"]);

function createClient({apiKey, apiUrl}) {
  return axios.create({
    baseURL: apiUrl || "https://api.yorkhost.fr/client/v1",
    timeout: GET_TIMEOUT_MS,
    httpsAgent: agent,
    headers: {Authorization: `Bearer ${apiKey}`, Accept: "application/json"},
  });
}

async function fetchRaw(client, targetId) {
  return (await client.get(`/game-servers/${targetId}`)).data;
}

async function sendPowerRaw(client, targetId, action) {
  // Le timeout par requête écrase celui du client pour ce POST uniquement.
  await client.post(`/game-servers/${targetId}/power`, {action}, {timeout: POWER_TIMEOUT_MS});
}

// Normalise `address` vers le contrat commun `{ip, port}` (ou null).
// Accepte : objet {ip, port}, objet {host, port}, string "ip:port".
function normalizeAddress(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const idx = raw.lastIndexOf(":");
    if (idx <= 0) return {ip: raw, port: null};
    const ip = raw.slice(0, idx);
    const port = Number(raw.slice(idx + 1));
    return {ip, port: Number.isFinite(port) ? port : null};
  }
  if (typeof raw === "object") {
    const ip = raw.ip ?? raw.host ?? null;
    const port = raw.port ?? null;
    if (ip == null && port == null) return null;
    return {ip, port: Number.isFinite(Number(port)) ? Number(port) : null};
  }
  return null;
}

function normalize(raw) {
  const rawState = String(raw.state || "unknown").toLowerCase();
  const state = ONLINE.has(rawState) ? "running"
              : OFFLINE.has(rawState) ? "stopped"
              : rawState;
  // players / uptimeSeconds : l'API YorkHost expose ces champs mais peut les
  // renvoyer null même serveur running (constaté sur un serveur « ApaWorld » :
  // {"players": null, "uptimeSeconds": null}). La doc ne documente aucun autre
  // endpoint fournissant ces valeurs (/metrics = séries CPU/RAM uniquement).
  // Le contrat tolère null : le dashboard masque ces champs quand ils sont
  // absents (l'uptime reste utilisé en interne par la détection de redémarrage).
  return {
    name: raw.name ?? null,
    state,
    raw_state: rawState,
    cpuPct: raw.cpuPct ?? null,
    ramMb: raw.ramMb ?? null,
    ramMaxMb: raw.ramMaxMb ?? null,
    diskMb: raw.diskMb ?? null,
    diskMaxMb: raw.diskMaxMb ?? null,
    uptimeSeconds: raw.uptimeSeconds ?? null,
    players: raw.players ?? null,
    address: normalizeAddress(raw.address),
    node: raw.node ?? null,
  };
}

module.exports = {
  name: "yorkhost",
  displayName: "YorkHost",
  kind: "game",
  icon: "🎮",
  defaultApiUrl: "https://api.yorkhost.fr/client/v1",
  createClient,
  fetchRaw,
  sendPowerRaw,
  normalize,
  GET_TIMEOUT_MS,
  POWER_TIMEOUT_MS,
};
