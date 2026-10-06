"use strict";

// Contrat d'un provider (type de serveur pilotable).
// Un provider est un module exposant :
//
//   name          {string}  identifiant technique (PROVIDER=...)
//   displayName   {string}  nom affichable
//   kind          {string}  catégorie libre : "game", "vps", "generic", ...
//   icon          {string}  emoji d'affichage
//   defaultApiUrl {string}  URL de base par défaut (surchargeable par PROVIDER_API_URL)
//   createClient({apiKey, apiUrl})  → instance HTTP (axios)
//   fetchRaw(client, targetId)      → Promise<response brute>
//   sendPowerRaw(client, targetId, action) → Promise<void>
//   normalize(raw)                  → objet canonique {name, state, cpuPct, ramMb, ...}
//
// `state` DOIT être ramené au vocabulaire commun :
//   "running" | "stopped" | "starting" | "stopping" | "unknown"
// C'est ce qui permet à embeds.js / power.js / watchdog.js de rester provider-agnostiques.
//
// `address` DOIT être normalisé en objet `{ip, port}` (ou `null` si non disponible).
// Les consommateurs (embeds.js, watchdog.js) accèdent à `s.address.ip` / `s.address.port`.
// Un provider qui reçoit une string "ip:port" ou un objet `{host, port}` doit la convertir.

const REQUIRED = [
  "name", "displayName", "kind", "icon", "defaultApiUrl",
  "createClient", "fetchRaw", "sendPowerRaw", "normalize",
];

function validate(mod) {
  if (!mod || typeof mod !== "object") throw new Error("Provider must be an object");
  for (const k of REQUIRED) {
    if (mod[k] == null) throw new Error(`Provider "${mod.name || "?"}" is missing "${k}"`);
  }
  return mod;
}

module.exports = {validate};
