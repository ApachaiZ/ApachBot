"use strict";

// Provider OVHcloud — instances VPS (https://www.ovhcloud.com/fr/vps/).
// API officielle : https://api.ovh.com/console/ — branche /v1 (stable PRODUCTION).
//
// Endpoints utilisés (confirmés le 2026-10-06 via le schéma officiel
// https://eu.api.ovh.com/v1/vps.json et contre l'API de production) :
//   GET  /vps/{serviceName}        → informations du VPS (champs `state`,
//                                    `displayName`, `model`, `zone`, ...)
//   POST /vps/{serviceName}/start  → démarre le VPS
//   POST /vps/{serviceName}/stop   → arrête le VPS
//   POST /vps/{serviceName}/reboot → redémarre le VPS
//   GET  /vps/{serviceName}/ips    → liste des IP attachées au VPS
//
// Authentification (3 clés, doc officielle
// https://docs.ovhcloud.com/en/guides/manage-and-operate/api/first-steps.md) :
//   AK = clé application    → paramètre `apiKey` de createClient()
//   AS = secret application → variable d'environnement OVH_APPLICATION_SECRET
//   CK = clé consommateur   → variable d'environnement OVH_CONSUMER_KEY
// Signature : "$1$" + SHA1_HEX(AS+"+"+CK+"+"+METHOD+"+"+QUERY+"+"+BODY+"+"+TSTAMP),
// envoyée via les en-têtes X-Ovh-Application, X-Ovh-Consumer, X-Ovh-Timestamp
// et X-Ovh-Signature. Les variables d'environnement sont lues UNIQUEMENT dans
// createClient() (jamais au chargement du module), ce qui permet de changer
// l'environnement entre deux instanciations.
//
// URL de base : https://eu.api.ovh.com/v1 (Europe). Choix documenté : la région
// Europe héberge la majorité des VPS OVHcloud et son endpoint est stable depuis
// l'origine de l'API. Alternatives officielles : https://ca.api.ovh.com/v1
// (Amérique du Nord) et https://api.us.ovhcloud.com/v1 (US), surchargeables via
// `apiUrl` ou le mécanisme générique PROVIDER_API_URL de YorkBot.
//
// Choix de normalisation documentés (normalize) :
//   state "running"  → "running"  ; "stopped" → "stopped" ;
//   state "rebooting" → "stopping" (le VPS s'arrête avant de redémarrer) ;
//   state "rescued"  → "unknown"  (le VPS tourne sous un système de secours,
//                     les services réels ne sont pas actifs : afficher
//                     "running" serait trompeur) ;
//   tout autre état OVH ("installed", "suspended", "updating", ...) → "unknown".
//   L'état brut est conservé en minuscules dans `raw_state`.
//   address → null : l'API ne renvoie PAS l'IP dans GET /vps/{serviceName} ;
//   elle est disponible via GET /vps/{serviceName}/ips (appel séparé, non
//   effectué ici pour ne pas multiplier les requêtes).
//   cpuPct / ram* / disk* / uptime / players → null : non fournis par l'endpoint.
//   node → raw.zone (ex. "fr-1") si présent, sinon null.
//
// Remarque d'exploitation : l'API rejette les signatures dont l'horodatage est
// trop ancien (dérive d'horloge). En cas d'erreur 401 « invalid timestamp »,
// resynchroniser l'horloge de la machine (les SDK officiels utilisent
// GET /auth/time à cet effet).

const https = require("node:https");
const crypto = require("node:crypto");
const axios = require("axios");

const agent = new https.Agent({keepAlive: true, maxSockets: 16});

// États OVHcloud → vocabulaire commun du contrat (lib/providers/base.js).
const RUNNING = new Set(["running"]);
const STOPPED = new Set(["stopped"]);
const STOPPING = new Set(["rebooting"]);
// "rescued" : volontairement absent des ensembles → "unknown" (voir en-tête).

// Calcule la signature OVHcloud d'une requête.
// Chaîne signée : AS + "+" + CK + "+" + METHOD + "+" + QUERY + "+" + BODY + "+" + TSTAMP,
// hachée en SHA1 (hex minuscules) et préfixée par "$1$".
// Exportée pour être testable sans réseau ni environnement.
function sign({method, url, body = "", applicationSecret, consumerKey, timestamp}) {
  const toSign = [
    applicationSecret,
    consumerKey,
    String(method).toUpperCase(),
    url,
    body,
    timestamp,
  ].join("+");
  return "$1$" + crypto.createHash("sha1").update(toSign, "utf8").digest("hex");
}

// Corps de requête tel qu'il sera signé : string JSON ou chaîne vide.
function formatBody(data) {
  if (data == null) return "";
  return typeof data === "string" ? data : JSON.stringify(data);
}

function createClient({apiKey, apiUrl}) {
  // Secrets lus ici uniquement (jamais au chargement du module).
  const applicationSecret = process.env.OVH_APPLICATION_SECRET;
  const consumerKey = process.env.OVH_CONSUMER_KEY;

  const client = axios.create({
    baseURL: apiUrl || "https://eu.api.ovh.com/v1",
    timeout: 15000,
    httpsAgent: agent,
    headers: {"Content-Type": "application/json", Accept: "application/json"},
  });

  // Intercepteur : signe chaque requête sortante avec les 3 clés OVHcloud.
  client.interceptors.request.use((config) => {
    const method = String(config.method || "get").toUpperCase();
    // URL signée = chemin (baseURL exclue) + éventuelle query string.
    let target = config.url || "/";
    if (config.params && Object.keys(config.params).length > 0) {
      target += `?${new URLSearchParams(config.params).toString()}`;
    }
    const body = formatBody(config.data);
    const timestamp = Math.round(Date.now() / 1000); // secondes UNIX
    config.headers["X-Ovh-Application"] = apiKey;
    config.headers["X-Ovh-Consumer"] = consumerKey;
    config.headers["X-Ovh-Timestamp"] = timestamp;
    config.headers["X-Ovh-Signature"] = sign({
      method,
      url: target,
      body,
      applicationSecret,
      consumerKey,
      timestamp,
    });
    return config;
  });

  return client;
}

async function fetchRaw(client, targetId) {
  return (await client.get(`/vps/${encodeURIComponent(targetId)}`)).data;
}

// action : "start" | "stop" | "restart" → POST /vps/{serviceName}/{start|stop|reboot}.
const POWER_ACTIONS = {start: "start", stop: "stop", restart: "reboot"};

async function sendPowerRaw(client, targetId, action) {
  const endpoint = POWER_ACTIONS[action];
  if (!endpoint) throw new Error(`Action d'alimentation inconnue : "${action}"`);
  await client.post(`/vps/${encodeURIComponent(targetId)}/${endpoint}`);
}

function normalize(raw) {
  const rawState = String(raw.state || "unknown").toLowerCase();
  const state = RUNNING.has(rawState) ? "running"
              : STOPPED.has(rawState) ? "stopped"
              : STOPPING.has(rawState) ? "stopping"
              : "unknown";
  return {
    name: raw.displayName ?? raw.model ?? null,
    state,
    raw_state: rawState,
    cpuPct: null,
    ramMb: null,
    ramMaxMb: null,
    diskMb: null,
    diskMaxMb: null,
    uptimeSeconds: null,
    players: null,
    address: null, // IP via GET /vps/{serviceName}/ips (appel séparé, non fait ici).
    node: raw.zone ?? null,
  };
}

module.exports = {
  name: "ovh",
  displayName: "OVHcloud",
  kind: "vps",
  icon: "☁️",
  defaultApiUrl: "https://eu.api.ovh.com/v1",
  createClient,
  fetchRaw,
  sendPowerRaw,
  normalize,
  sign,
};
