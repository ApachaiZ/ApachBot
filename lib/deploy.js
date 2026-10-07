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

// ── État persisté du déploiement ────────────────────────────────────────
// Format actuel : JSON {guild, hash}. Format hérité (ancienne version) :
// simple chaîne hexadécimale de 64 caractères — la guilde d'alors est inconnue,
// on la suppose égale à la guilde courante (purge d'ancienne guilde impossible
// dans ce cas précis).
function readDeployState() {
  try {
    const raw = fs.readFileSync(commandsHashFile, "utf8").trim();
    if (!raw) return null;
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.hash === "string"
        && (parsed.guild == null || typeof parsed.guild === "string" || typeof parsed.guild === "number")) {
        return {guild: parsed.guild == null ? String(cfg.guild_id) : String(parsed.guild), hash: parsed.hash};
      }
      return null;
    }
    if (/^[0-9a-f]{64}$/.test(raw)) return {guild: String(cfg.guild_id), hash: raw};
    return null;
  } catch {
    return null;
  }
}

function writeDeployState(hash) {
  try {
    fs.mkdirSync(path.dirname(commandsHashFile), {recursive: true});
    fs.writeFileSync(commandsHashFile, JSON.stringify({guild: String(cfg.guild_id), hash}), {mode: 0o600});
  } catch (err) {
    logger.error(t("audit.commandsHashFailed", {error: err.message}));
  }
}

// Purge des commandes GLOBALES de l'application. Le bot n'enregistre que des
// commandes de guilde ; toute commande globale résiduelle (version antérieure,
// enregistrement manuel…) apparaîtrait EN DOUBLE dans l'autocomplétion Discord
// (une copie globale + une copie de guilde). On purge donc à CHAQUE démarrage —
// même quand le hash n'a pas changé — pour que l'état d'un utilisateur déjà
// affecté soit réparé au prochain restart. Best-effort : un échec (réseau,
// scope applications.commands manquant) ne bloque jamais le démarrage.
async function purgeGlobalCommands(rest) {
  try {
    await rest.put(Routes.applicationCommands(cfg.client_id), {body: []});
    logger.info(t("audit.commandsGlobalPurged"));
  } catch (err) {
    logger.warn(t("audit.commandsGlobalPurgeFailed", {error: err.message}));
  }
}

async function deployCommandsIfNeeded(restOverride = null) {
  const rest = restOverride || new REST({version: "10"}).setToken(cfg.token);
  await purgeGlobalCommands(rest);

  const hash = commandsHash();
  const previous = readDeployState();
  if (previous && previous.hash === hash) {
    logger.info(t("audit.commandsSkipped"));
    return;
  }

  // Changement de guilde : les commandes de l'ANCIENNE guilde resteraient
  // exposées côté Discord (le bot y répondrait par « configured for a
  // different server »). On les purge. Best-effort : le bot a pu être retiré
  // de l'ancienne guilde — un échec ici ne doit pas bloquer l'enregistrement.
  if (previous && previous.guild && previous.guild !== String(cfg.guild_id)) {
    try {
      await rest.put(Routes.applicationGuildCommands(cfg.client_id, previous.guild), {body: []});
      logger.info(t("audit.commandsOldGuildPurged", {guild: previous.guild}));
    } catch (err) {
      logger.warn(t("audit.commandsOldGuildPurgeFailed", {guild: previous.guild, error: err.message}));
    }
  }

  try {
    // Une seule requête PUT : remplace l'ensemble des commandes de guilde.
    await rest.put(Routes.applicationGuildCommands(cfg.client_id, cfg.guild_id), {
      body: commands.map((c) => c.toJSON()),
    });
  } catch (err) {
    throw friendlyDeployError(err);
  }

  writeDeployState(hash);
  logger.info(t("audit.commandsRegistered"));
}

// commandsHash, readDeployState et purgeGlobalCommands sont exportés pour les
// tests : le mécanisme d'idempotence et la purge anti-doublons deviennent vérifiables.
module.exports = {deployCommandsIfNeeded, commandsHash, friendlyDeployError, readDeployState, purgeGlobalCommands};
