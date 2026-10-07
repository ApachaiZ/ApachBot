"use strict";
const fs = require("node:fs");
const {statsFile} = require("./paths");
const logger = require("./logger");

// Durées moyennes des actions power (start/stop/restart), recalculées à
// chaque transaction réussie et persistées sur disque (données non privées :
// simples durées). Utilisées pour annoncer une estimation sur la carte
// « Action acceptée » : « En moyenne : 51 s ».
// Format : { action: {count, sumMs} }.
function readAll() {
  try {
    const data = JSON.parse(fs.readFileSync(statsFile, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch { return {}; }
}

function writeAll(map) {
  try { fs.writeFileSync(statsFile, JSON.stringify(map)); }
  catch (err) { logger.warn(`stats: impossible d'écrire ${statsFile} : ${err.message}`); }
}

// Durée moyenne en secondes (arrondie), ou null si aucune transaction connue.
function avgSeconds(action) {
  const e = readAll()[action];
  if (!e || !Number.isFinite(e.count) || e.count <= 0 || !Number.isFinite(e.sumMs)) return null;
  return Math.max(1, Math.round(e.sumMs / e.count / 1000));
}

function record(action, ms) {
  const all = readAll();
  const e = all[action] || {count: 0, sumMs: 0};
  e.count += 1;
  e.sumMs += ms;
  all[action] = e;
  writeAll(all);
}

module.exports = {avgSeconds, record};
