"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const {cfg} = require("./config");
const logger = require("./logger");

// Chiffrement au repos des données privées persistées (.apach/users.json,
// sessions.json, members.roster.json) : AES-256-GCM, clé dérivée du token
// Discord (sha256) — aucun secret supplémentaire à gérer. Quiconque lirait
// ces fichiers sans le token n'y verra qu'un blob base64 opaque.
//
// ⚠ Corollaire : ROTATION du token Discord = fichiers illisibles. En cas de
// rotation, supprimez les fichiers concernés (le bot les recréera) ou
// re-sauvegardez les données avant.
//
// Migration silencieuse : un fichier EN CLAIR hérité d'une version
// antérieure reste lisible (repli sur JSON.parse) et sera réécrit chiffré
// à la prochaine sauvegarde.
const KEY_DOMAIN = "apach-v1:";

function key() {
  return crypto.createHash("sha256").update(KEY_DOMAIN + String(cfg.token || "")).digest();
}

// JSON → base64(iv ‖ tag ‖ ciphertext)
function encryptJson(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

// base64(iv ‖ tag ‖ ciphertext) → JSON. Lève une erreur si le contenu est
// altéré (tag d'authentification GCM) ou chiffré avec une autre clé.
function decryptJson(str) {
  const buf = Buffer.from(String(str), "base64");
  if (buf.length < 28) throw new Error("ciphertext trop court");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8"));
}

// Lecture tolérante : chiffré → clair (hérité) → undefined.
function readJson(file) {
  let raw;
  try { raw = fs.readFileSync(file, "utf8").trim(); } catch { return undefined; }
  if (!raw) return undefined;
  try { return decryptJson(raw); } catch { /* pas chiffré ou altéré */ }
  try { return JSON.parse(raw); } catch (err) {
    logger.warn(`crypto: ${file} illisible (chiffré avec une autre clé ou corrompu) : ${err.message}`);
    return undefined;
  }
}

// Écriture chiffrée atomique (tmp + rename), mode 0600.
function writeJson(file, obj) {
  const temp = file + ".tmp";
  fs.writeFileSync(temp, encryptJson(obj), {mode: 0o600});
  try { fs.chmodSync(temp, 0o600); } catch {}
  fs.renameSync(temp, file);
}

module.exports = {encryptJson, decryptJson, readJson, writeJson};
