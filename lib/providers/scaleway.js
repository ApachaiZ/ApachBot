"use strict";

// Provider Scaleway (Instance API v1) pour YorkBot.
//
// Variables d'environnement lues DANS createClient uniquement :
//   SCW_PROJECT_ID  ID de projet Scaleway (requis par l'API, lu ici pour
//                   rester disponible aux consommateurs sans être renvoyé).
//   SCW_ZONE        Zone de disponibilité (ex. "fr-par-1", "nl-ams-1").
//                   Défaut : "fr-par-1". La zone est OBLIGATOIRE dans l'URL
//                   de l'Instance API : /instance/v1/zones/{zone}/...
//
// Authentification : header "X-Auth-Token: <secret key>" (apiKey).
// Endpoints utilisés (doc officielle : https://www.scaleway.com/en/developers/api/instance/v1) :
//   GET  /instance/v1/zones/{zone}/servers/{server_id}          → état (champ `state`)
//   POST /instance/v1/zones/{zone}/servers/{server_id}/action   → {action: "poweron"|"poweroff"|"reboot"}

const https = require("node:https");
const axios = require("axios");

// Agent keepAlive partagé, comme le provider yorkhost.
const agent = new https.Agent({keepAlive: true, maxSockets: 16});

// Actions utilisateur (vocabulaire YorkBot) → actions API Scaleway.
const POWER_ACTIONS = {start: "poweron", stop: "poweroff", restart: "reboot"};

function createClient({apiKey, apiUrl}) {
  // Lecture des variables d'environnement uniquement ici, pour garder
  // normalize() et les helpers purs et testables sans env.
  // SCW_PROJECT_ID est exigé par l'API Scaleway (pas d'avertissement ici :
  // createClient est appelé à chaque requête du bot, un log spammerait la
  // console ; l'API renverra une erreur explicite si le projet est manquant).
  const projectId = process.env.SCW_PROJECT_ID || null; // eslint-disable-line no-unused-vars
  void projectId;
  const zone = process.env.SCW_ZONE || "fr-par-1";

  // La zone est intégrée à la baseURL : elle est obligatoire dans l'URL.
  const base = apiUrl || "https://api.scaleway.com";
  return axios.create({
    baseURL: `${base}/instance/v1/zones/${zone}`,
    timeout: 15000,
    httpsAgent: agent,
    headers: {"X-Auth-Token": apiKey, Accept: "application/json"},
  });
}

async function fetchRaw(client, targetId) {
  return (await client.get(`/servers/${targetId}`)).data;
}

async function sendPowerRaw(client, targetId, action) {
  const actionApi = POWER_ACTIONS[action];
  if (!actionApi) {
    throw new Error(`scaleway: action inconnue "${action}" (attendu : start|stop|restart)`);
  }
  await client.post(`/servers/${targetId}/action`, {action: actionApi});
}

function normalize(raw) {
  // État brut, toujours en minuscules ; "unknown" si absent.
  const rawState = String(raw.state || "unknown").toLowerCase();
  // Vocabulaire commun du contrat provider (base.js).
  // "locked" → "unknown" : un serveur verrouillé par Scaleway (snapshot,
  // maintenance, opération en cours) n'est ni démarré ni arrêté de façon
  // exploitable ; on préfère l'état neutre "unknown".
  const KNOWN_STATES = new Set(["running", "stopped", "starting", "stopping"]);
  const state = KNOWN_STATES.has(rawState) ? rawState : "unknown";

  return {
    name: raw.name ?? null,
    state,
    raw_state: rawState,
    // L'Instance API ne fournit pas ces métriques en temps réel
    // (il faudrait un agent/probe à l'intérieur de la VM) → null.
    cpuPct: null,
    ramMb: null,
    ramMaxMb: null,
    diskMb: null,
    diskMaxMb: null,
    uptimeSeconds: null,
    players: null,
    address: raw.public_ip?.address ? {ip: raw.public_ip.address, port: null} : null,
    node: raw.zone ?? null,
  };
}

module.exports = {
  name: "scaleway",
  displayName: "Scaleway",
  kind: "vps",
  icon: "☁️",
  defaultApiUrl: "https://api.scaleway.com",
  createClient,
  fetchRaw,
  sendPowerRaw,
  normalize,
};
