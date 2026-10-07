"use strict";

// Provider Vultr (https://api.vultr.com — OpenAPI : https://www.vultr.com/api/).
// Ne dépend que de node:https et d'axios : aucun require de config.js, i18n
// ou autre module du bot au chargement (voir contrat base.js).
//
// API utilisée (doc officielle v2, vérifiée le 2026-10-06) :
//   GET  /v2/instances/{id}        → {instance: {status, label, hostname,
//                                     main_ip, vcpu_count, ram, disk, region, ...}}
//   POST /v2/instances/{id}/start  → allumer  (aucun corps de requête)
//   POST /v2/instances/{id}/halt   → éteindre (aucun corps de requête)
//   POST /v2/instances/{id}/reboot → redémarrer (aucun corps de requête)
//   Auth : header "Authorization: Bearer <API key>" + Accept: application/json.
//
// Unités (doc officielle OpenAPI v2) :
//   - ram  : RAM totale du plan, en Mo — ex. plan « 3072 GB » → ram 3145728
//            (3072 × 1024) dans l'échantillon officiel.
//   - disk : disque total du plan, en Go — ex. 8 disques → disk 3840
//            (480 Go/disque) dans l'échantillon officiel. Converti en Mo ici.

const https = require("node:https");
const axios = require("axios");

// Agent keep-alive partagé (réutilisation des connexions TLS).
const agent = new https.Agent({keepAlive: true, maxSockets: 16});

const DEFAULT_API_URL = "https://api.vultr.com";

// Mappage status Vultr (v2) → vocabulaire commun du contrat (base.js).
// - active  : instance en marche.
// - stopped : instance éteinte (facturée mais sans CPU/RAM alloués).
// - pending : provisionnement/démarrage en cours → assimilé à "starting".
// Toute autre valeur ("suspended", "resizing", ...) → "unknown".
const STATE_MAP = {
  active: "running",
  stopped: "stopped",
  pending: "starting",
};

// Action générique (contrat) → chemin d'action Vultr.
// "stop" correspond à /halt : Vultr distingue halt (arrêt propre) de
// power off, et c'est bien POST /halt qui sert d'arrêt standard.
const ACTION_MAP = {
  start: "start",
  stop: "halt",
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
  // Réponse brute (enveloppe {instance: {...}}) laissée telle quelle :
  // normalize() sait la déplier.
  return (await client.get(`/v2/instances/${targetId}`)).data;
}

async function sendPowerRaw(client, targetId, action) {
  const verb = ACTION_MAP[action];
  if (!verb) throw new Error(`Action inconnue pour vultr: "${action}"`);
  // Les endpoints d'action Vultr n'acceptent aucun corps de requête.
  await client.post(`/v2/instances/${targetId}/${verb}`);
}

// Conversion sûre en nombre fini, sinon null (tolère "2048" en string).
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalize(raw) {
  // L'API renvoie {instance: {...}} ; on accepte aussi un objet déjà déplié.
  const s = (raw && typeof raw === "object" && raw.instance) || raw || {};
  const rawState = String(s.status ?? "unknown").toLowerCase();

  // ram (Mo) et disk (Go) sont des TOTAUX de plan : ils alimentent donc
  // ramMaxMb / diskMaxMb. L'usage courant (ramMb / diskMb) n'est pas
  // exposé par l'API v2 → null.
  const ram = toNumber(s.ram);
  const disk = toNumber(s.disk);

  return {
    name: s.label ?? s.hostname ?? null,
    state: STATE_MAP[rawState] ?? "unknown",
    raw_state: rawState,
    // L'API Vultr n'expose pas les métriques d'usage en direct
    // (CPU/RAM utilisée/disque utilisé/uptime/joueurs).
    cpuPct: null,
    ramMb: null,
    ramMaxMb: ram, // déjà en Mo (doc officielle).
    diskMb: null,
    diskMaxMb: disk !== null ? disk * 1024 : null, // Go → Mo.
    uptimeSeconds: null,
    players: null,
    // IPv4 principale si disponible (l'API ne fournit pas de port ici).
    address: s.main_ip ? {ip: s.main_ip, port: null} : null,
    node: s.region ?? null,
  };
}

module.exports = {
  name: "vultr",
  displayName: "Vultr",
  kind: "vps",
  icon: "☁️",
  defaultApiUrl: DEFAULT_API_URL,
  createClient,
  fetchRaw,
  sendPowerRaw,
  normalize,
};
