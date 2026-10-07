"use strict";
const {MessageFlags} = require("discord.js");
const {cfg, resolveService} = require("./config");
const {get} = require("./api");
const {card, payload, dashboard} = require("./embeds");
const {isAllowed, getSession, setSession, clearSession} = require("./state");
const {commands} = require("./commands");
const {power} = require("./power");
const {manage} = require("./manage");
const {logs} = require("./logs");
const {ping} = require("./ping");
const {t} = require("./i18n");
const logger = require("./logger");

// Codes axios signalant que la requête n'a PAS reçu de réponse HTTP dans les temps.
const TIMEOUT_CODES = new Set(["ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED", "ERR_TIMEOUT"]);
// Codes axios signalant un problème de connectivité (jamais transmis au provider).
const NETWORK_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ERR_NETWORK", "ERR_CONNECTION_RESET", "ERR_SOCKET_CLOSED"]);

// Messages d'erreur HONNÊTES : chaque cause produit un message dédié au lieu du
// « vérifiez votre clé API » fourre-tout d'avant. `err._powerSent === true` est
// posé par power.js quand le POST est parti mais a renvoyé une erreur (timeout,
// 5xx après exécution…) : l'action a pu être appliquée côté provider, on le dit.
function errorText(err, context = "power") {
  const status = err.response?.status;
  const code = err.response?.data?.code;
  const networkCode = err.code;
  const powerSent = err._powerSent === true;
  logger.error("Request failure", {status, code, networkCode, powerSent, context});
  const statusPart = status ? t("errors.requestFailedStatus", {status}) : "";
  const codePart = typeof code === "string" ? t("errors.requestFailedCode", {code}) : "";
  const suffix = context === "power" ? t("errors.requestFailedPowerSuffix") : "";

  if (status === 401) return t("errors.requestFailedAuth", {statusPart, codePart, suffix});
  if (status === 403) return t("errors.requestFailedForbidden", {statusPart, codePart, suffix});
  if (status === 404) return t("errors.requestFailedNotFound", {statusPart, codePart, suffix});
  if (status === 429) return t("errors.requestFailedRateLimit", {statusPart, codePart, suffix});
  if (status >= 500) {
    return t(powerSent ? "errors.requestFailedServerSent" : "errors.requestFailedServer", {statusPart, codePart, suffix});
  }
  if (status) return t("errors.requestFailed", {statusPart, codePart, suffix});
  if (TIMEOUT_CODES.has(networkCode)) {
    return t(powerSent ? "errors.requestFailedTimeoutSent" : "errors.requestFailedTimeout", {suffix});
  }
  if (NETWORK_CODES.has(networkCode)) return t("errors.requestFailedNetwork", {suffix});
  // Erreur non classifiée (erreur métier provider, etc.) : on montre le message
  // réel plutôt que d'accuser la clé API.
  return t("errors.requestFailedGeneric", {message: err.message || "unknown error", suffix});
}

async function handleInteraction(i) {
  if (!i.isChatInputCommand()) return;
  if (!commands.some((c) => c.name === i.commandName)) return;
  try {
    await i.deferReply({flags: MessageFlags.Ephemeral});
    if (i.guildId !== String(cfg.guild_id)) {
      const c = t("common.accessDeniedGuild");
      await i.editReply(payload(card(c.title, c.body, "bad")));
      return;
    }
    if (i.commandName === "help") {
      await i.editReply(payload(card(t("help.title"), t("help.body"))));
      return;
    }
    // Politique de permission :
    //   - /users et /logs : owner uniquement (vérifié dans manage.js / logs.js).
    //   - /help : public.
    //   - Toutes les autres : opérateur (isAllowed) — vérifié ici, puis
    //     revérifié dans power.js après confirmation pour couvrir une
    //     éventuelle révocation pendant l'attente.
    if (i.commandName === "users") { await manage(i); return; }
    if (i.commandName === "logs") { await logs(i); return; }
    if (!isAllowed(i.user.id)) {
      const c = t("common.accessDeniedMember");
      await i.editReply(payload(card(c.title, c.body, "bad")));
      return;
    }
    if (i.commandName === "server") {
      const alias = i.options.getString("service", true);
      if (!cfg.services[alias]) {
        const c = t("common.unknownService", {alias});
        await i.editReply(payload(card(c.title, c.body, "bad")));
        return;
      }
      setSession(i.user.id, alias);
      const cd = t("common.defaultService", {alias});
      await i.editReply(payload(card(cd.title, cd.body)));
      return;
    }
    const serviceAlias = i.options.getString("service") || getSession(i.user.id) || undefined;
    // Session obsolète : l'alias mémorisé via /server peut avoir été retiré de
    // PROVIDER_SERVICES entre-temps. Sans ce garde-fou, resolveService() lèverait
    // une erreur générique interprétée comme un problème d'API (message trompeur).
    // On purge la session et on informe explicitement l'utilisateur.
    if (serviceAlias && !cfg.services[serviceAlias]) {
      clearSession(i.user.id);
      const c = t("common.sessionReset", {alias: serviceAlias});
      await i.editReply(payload(card(c.title, c.body, "wait")));
      return;
    }
    if (i.commandName === "ping") { await ping(i, serviceAlias); return; }
    if (i.commandName === "status") {
      const service = resolveService(serviceAlias);
      const s = await get(service.id);
      await i.editReply(payload(dashboard(s)));
      return;
    }
    if (["start", "stop", "restart"].includes(i.commandName)) {
      await power(i, i.commandName, serviceAlias);
      return;
    }
    // Garde-fou : toute commande non branchée explicitement ci-dessus ne doit
    // jamais atteindre power(), sous peine d'envoyer un POST /power avec une
    // action invalide. On log et on répond proprement.
    logger.warn(`Unhandled command "${i.commandName}" reached the fallback branch.`);
    const c = t("common.unhandledCommand");
    await i.editReply(payload(card(c.title, c.body, "bad")));
  } catch (err) {
    const ctx = ["start", "stop", "restart"].includes(i.commandName) ? "power" : "other";
    try {
      await i.editReply(payload(card(t("common.genericError.title"), errorText(err, ctx), "bad")));
    } catch (replyErr) {
      logger.error("Could not update Discord response:", replyErr.message);
    }
  }
}

module.exports = {handleInteraction, errorText};
