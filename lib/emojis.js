"use strict";
const path = require("node:path");

// Chemin des GIFs animés du bot (assets/emojis/) : loading (transmission),
// waiting (attente), success et error — tous servis en IMAGE d'embed par
// power.js (pièce jointe). Aucun autre mécanisme n'est nécessaire.
function gifPath(kind) {
  return path.join(__dirname, "..", "assets", "emojis", `${kind}.gif`);
}

module.exports = {gifPath};
