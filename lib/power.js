"use strict";
const {cfg, resolveService} = require("./config");
const {get, sendPower, clearCache} = require("./api");
const {card, payload, state, online, offline} = require("./embeds");
const {confirm} = require("./confirm");
const {isAllowed, writeLock, clearLock, loadPersistedLock} = require("./state");
const {t} = require("./i18n");
const logger = require("./logger");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Backoff progressif : [5s ×3, 10s ×3, 15s ×2, 20s ×2, puis 30s].
// Réduit la latence pour les actions rapides (stop) et la charge API pour les lentes (start).
const POLL_DELAYS = [5000, 5000, 5000, 10000, 10000, 10000, 15000, 15000, 20000, 20000, 30000];

async function power(i, action, serviceAlias) {
  // Vérification de permission en amont : évite d'exposer l'état du verrou
  // et de monopoliser un slot de confirmation pour un utilisateur non autorisé.
  if (!isAllowed(i.user.id)) {
    const c = t("power.accessDenied");
    await i.editReply(payload(card(c.title, c.body, "bad")));
    return;
  }
  const service = resolveService(serviceAlias);
  // Relecture du verrou à chaque appel : l'état disque est la source de vérité
  // (un autre processus ou une édition manuelle peut l'avoir modifié).
  const active = loadPersistedLock();
  if (active[service.alias]) {
    const c = t("power.actionInProgress", {action: active[service.alias], alias: service.alias});
    await i.editReply(payload(card(c.title, c.body, "wait")));
    return;
  }
  const warning = (action === "stop" || action === "restart") ? t("power.confirm.warning") : "";
  const confirmBody = warning + t("power.confirm.body", {action, alias: service.alias});
  if (!await confirm(i, card(t("power.confirm.title", {action}), confirmBody, "wait"))) return;

  // Revérification post-confirmation : une révocation pendant l'attente doit prendre effet.
  if (!isAllowed(i.user.id)) {
    const c = t("power.accessRevoked");
    await i.editReply(payload(card(c.title, c.body, "bad")));
    return;
  }
  // Relecture : une autre action a pu démarrer pendant la confirmation.
  const activeNow = loadPersistedLock();
  if (activeNow[service.alias]) {
    const c = t("power.busy", {alias: service.alias});
    await i.editReply(payload(card(c.title, c.body, "wait")));
    return;
  }

  writeLock(service.alias, action);
  try {
    const before = await get(service.id, {fresh: true});
    if ((action === "start" && online(before)) || (action === "stop" && offline(before))) {
      const c = t("power.alreadyInTargetState", {state: state(before)});
      await i.editReply(payload(card(c.title, c.body, "good")));
      return;
    }
    await sendPower(service.id, action);
    clearCache(service.id);
    logger.info(t("audit.powerRequested", {action, userId: i.user.id, alias: service.alias}));

    const start = Date.now(), timeout = 600000;
    let transition = false, stable = 0, lastKnown = before, failures = 0, iteration = 0;
    const ca = t("power.accepted", {action: action.toUpperCase()});
    await i.editReply(payload(card(ca.title, ca.body, "wait")));

    while (Date.now() - start < timeout) {
      const delay = POLL_DELAYS[Math.min(iteration, POLL_DELAYS.length - 1)];
      iteration++;
      await sleep(delay);
      let s;
      try { s = await get(service.id, {fresh: true}); lastKnown = s; failures = 0; } catch { if (++failures >= 5) break; continue; }
      if (!online(s)) transition = true;
      const uptimeReset = Number.isFinite(before.uptimeSeconds) && Number.isFinite(s.uptimeSeconds) && s.uptimeSeconds < before.uptimeSeconds;
      const reached = action === "stop" ? offline(s) : action === "start" ? online(s) : online(s) && (transition || uptimeReset);
      stable = reached ? stable + 1 : 0;
      if (stable >= 2) {
        const seconds = Math.round((Date.now() - start) / 1000);
        logger.info(t("audit.powerConfirmed", {action, alias: service.alias, provider: cfg.provider_label, seconds}));
        const tail = action !== "stop" ? t("power.completed.tail") : "";
        const body = t("power.completed.body", {
          action: action.toUpperCase(),
          provider: cfg.provider_label,
          state: state(s).toUpperCase(),
          seconds,
        }) + tail;
        const cc = t("power.completed");
        await i.editReply(payload(card(cc.title, body, "good")));
        return;
      }
    }
    logger.warn(t("audit.powerNotConfirmed", {action, alias: service.alias, failures}));
    const nc = t("power.notConfirmed");
    const ncBody = failures >= 5
      ? t("power.notConfirmed.bodyFailed", {state: state(lastKnown)})
      : t("power.notConfirmed.bodyTimeout", {state: state(lastKnown)});
    await i.editReply(payload(card(nc.title, ncBody, "wait")));
  } finally {
    clearLock(service.alias);
  }
}

module.exports = {power};
