"use strict";

// Source unique de vérité pour la détection de valeur non définie ou
// placeholder. Importé par setup.js pour éviter la duplication.
const isUnset = (v) => v == null || String(v).trim() === "" || String(v).startsWith("YOUR_");

// Accepte "alias1=id1,alias2=id2" ; retombe sur fallbackId avec alias "default".
function parseServices(raw, fallbackId) {
  const map = {};
  if (!isUnset(raw)) {
    for (const pair of String(raw).split(",")) {
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const alias = pair.slice(0, eq).trim();
      const id = pair.slice(eq + 1).trim();
      if (alias && !isUnset(id)) map[alias] = id;
    }
  }
  if (Object.keys(map).length === 0 && !isUnset(fallbackId)) {
    map.default = String(fallbackId).trim();
  }
  return map;
}

// Nommé `pickService` pour éviter la collision avec `config.resolveService(alias)`.
function pickService(services, defaultAlias, alias) {
  const key = isUnset(alias) ? defaultAlias : String(alias).trim();
  if (!services[key]) {
    const known = Object.keys(services).map((a) => `"${a}"`).join(", ");
    throw new Error(`Unknown service "${key}". Known: ${known}`);
  }
  return {alias: key, id: services[key]};
}

// Nom d'affichage d'un service : le nom transmis par l'API du provider s'il
// existe, sinon l'alias — qui sert de pseudonyme configurable dans
// PROVIDER_SERVICES (ex. `mon-serveur=svc-abc`). Utilisé par le watchdog,
// les cartes power et le dashboard pour ne plus afficher un alias technique.
function displayName(s, alias) {
  const n = s && typeof s.name === "string" ? s.name.trim() : "";
  return n || String(alias || "");
}

module.exports = {isUnset, parseServices, pickService, displayName};
