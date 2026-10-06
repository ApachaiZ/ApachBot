"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const {REST, Routes} = require("discord.js");
const {cfg} = require("./config");
const {commandsHashFile} = require("./paths");
const {t} = require("./i18n");
const logger = require("./logger");
const {commands} = require("./commands");

function commandsHash() {
  // Inclure guilde + application : changer de guilde doit forcer un ré-enregistrement.
  const payload = {
    guild: String(cfg.guild_id),
    app: String(cfg.client_id),
    cmds: commands.map((c) => c.toJSON()),
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// Traduit les erreurs Discord les plus courantes à l'enregistrement des
// commandes en messages actionnables. Exit 78 : problème de configuration
// qu'un humain doit corriger (invite du bot, Application ID) — PM2 ne
// redémarre pas en boucle (stop_exit_codes: [78]).
function friendlyDeployError(err) {
  const code = err?.code;
  if (code === 50001) { // Missing Access : bot absent de la guilde ou client_id incohérent
    const e = new Error(t("errors.deployMissingAccess", {guild: cfg.guild_id, client: cfg.client_id}));
    e.exitCode = 78;
    return e;
  }
  if (code === 10002) { // Unknown Application : client_id sans rapport avec le token
    const e = new Error(t("errors.deployUnknownApplication", {client: cfg.client_id}));
    e.exitCode = 78;
    return e;
  }
  return err;
}

// Limitation connue : changer de guilde force un ré-enregistrement dans la
// nouvelle guilde, mais les commandes de l'ancienne guilde restent exposées
// côté Discord (le bot y répondra par "configured for a different Discord
// server"). Pour purger l'ancienne guilde, il faudrait conserver son ID et
// appeler Routes.applicationGuildCommands(app, oldGuild) avec un body vide.
async function deployCommandsIfNeeded() {
  const hash = commandsHash();
  let previous = null;
  try { previous = fs.readFileSync(commandsHashFile, "utf8").trim(); } catch {}
  if (previous === hash) { logger.info(t("audit.commandsSkipped")); return; }

  const rest = new REST({version: "10"}).setToken(cfg.token);
  try {
    // Une seule requête PUT : remplace l'ensemble des commandes de guilde.
    await rest.put(Routes.applicationGuildCommands(cfg.client_id, cfg.guild_id), {
      body: commands.map((c) => c.toJSON()),
    });
  } catch (err) {
    throw friendlyDeployError(err);
  }

  try {
    fs.mkdirSync(path.dirname(commandsHashFile), {recursive: true});
    fs.writeFileSync(commandsHashFile, hash, {mode: 0o600});
  } catch (err) { logger.error(t("audit.commandsHashFailed", {error: err.message})); }
  logger.info(t("audit.commandsRegistered"));
}

// commandsHash est exporté pour les tests : le mécanisme d'idempotence devient vérifiable.
module.exports = {deployCommandsIfNeeded, commandsHash, friendlyDeployError};
