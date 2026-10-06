"use strict";
const https = require("node:https");
const axios = require("axios");

const agent = new https.Agent({keepAlive: true, maxSockets: 16});

const ONLINE = new Set(["running", "online"]);
const OFFLINE = new Set(["offline", "stopped"]);

function createClient({apiKey, apiUrl}) {
  return axios.create({
    baseURL: apiUrl || "https://api.yorkhost.fr/client/v1",
    timeout: 15000,
    httpsAgent: agent,
    headers: {Authorization: `Bearer ${apiKey}`, Accept: "application/json"},
  });
}

async function fetchRaw(client, targetId) {
  return (await client.get(`/game-servers/${targetId}`)).data;
}

async function sendPowerRaw(client, targetId, action) {
  await client.post(`/game-servers/${targetId}/power`, {action});
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
};
