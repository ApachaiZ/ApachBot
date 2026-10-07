"use strict";
const {cfg, provider} = require("./config");

const client = provider.createClient({apiKey: cfg.api_key, apiUrl: cfg.api_url});

// Cache court (5 s) : évite les GET redondants (watchdog + /status).
// Les appels critiques (avant/après un POST power, /ping) passent {fresh: true}
// et ignorent donc le cache. Le polling de power.js utilise toujours {fresh: true}.
const CACHE_TTL_MS = 5000;
const cache = new Map();   // id → {at, data}
const inflight = new Map(); // id → Promise

function clearCache(serviceId) {
  if (serviceId) cache.delete(serviceId);
  else cache.clear();
}

async function get(serviceId, {fresh = false} = {}) {
  const id = serviceId || cfg.service_id;
  // Dédup inconditionnelle : deux appels simultanés (fresh ou non) partagent
  // la même requête HTTP en vol. Le cache n'est consulté que pour les appels
  // non-fresh — un appel fresh doit toujours rafraîchir la donnée.
  const pending = inflight.get(id);
  if (pending) return pending;
  if (!fresh) {
    const hit = cache.get(id);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  }
  const p = provider.fetchRaw(client, id).then((raw) => {
    const norm = provider.normalize(raw);
    cache.set(id, {at: Date.now(), data: norm});
    return norm;
  }).finally(() => {
    if (inflight.get(id) === p) inflight.delete(id);
  });
  inflight.set(id, p);
  return p;
}

async function sendPower(serviceId, action) {
  return provider.sendPowerRaw(client, serviceId, action);
}

module.exports = {get, sendPower, clearCache};
