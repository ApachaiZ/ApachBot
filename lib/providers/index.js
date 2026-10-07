"use strict";
const {validate} = require("./base");

// Ajoute ici d'autres providers au fur et à mesure.
// Chaque provider implémente le contrat validé par ./base.js :
//   name, displayName, kind, icon, defaultApiUrl,
//   createClient, fetchRaw, sendPowerRaw, normalize.
const registry = {
  yorkhost: validate(require("./yorkhost")),
  hetzner: validate(require("./hetzner")),
  nitrado: validate(require("./nitrado")),
  ovh: validate(require("./ovh")),
  scaleway: validate(require("./scaleway")),
  digitalocean: validate(require("./digitalocean")),
  vultr: validate(require("./vultr")),
  upcloud: validate(require("./upcloud")),
};

function getProvider(name) {
  const p = registry[name];
  if (!p) {
    const known = Object.keys(registry).map((n) => `"${n}"`).join(", ");
    throw new Error(`Unknown provider "${name}". Known: ${known}`);
  }
  return p;
}

module.exports = {getProvider, listProviders: () => Object.keys(registry)};
