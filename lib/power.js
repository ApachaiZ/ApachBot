"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const {ActionRowBuilder, ButtonStyle, MessageFlags} = require("discord.js");
const {cfg, resolveService} = require("./config");
const {get, sendPower, clearCache} = require("./api");
const {card, payload, state, online, offline, button} = require("./embeds");
const {confirm} = require("./confirm");
const {isAllowed, writeLock, clearLock, loadPersistedLock, recordLockRelease} = require("./state");
const {mayHaveBeenTransmitted} = require("./errors");
const {displayName} = require("./services");
const {t} = require("./i18n");
const {gifPath} = require("./emojis");
const {avgSeconds, record} = require("./stats");
const logger = require("./logger");
const {shortId} = logger;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Backoff progressif : [5s ×3, 10s ×3, 15s ×2, 20s ×2, puis 30s].
// Réduit la latence pour les actions rapides (stop) et la charge API pour les lentes (start).
const POLL_DELAYS = [5000, 5000, 5000, 10000, 10000, 10000, 15000, 15000, 20000, 20000, 30000];

// Suivi maximal d'une action avant de déclarer la fin non confirmée.
const TRACKING_TIMEOUT_MS = 600000;

// Ligne d'estimation : « En moyenne : 51 s » — durée moyenne persistée des
// transactions réussies précédentes (lib/stats.js). Aucun compteur en direct.
function etaLine(action) {
  const avg = avgSeconds(action);
  return avg ? `\n${t("power.eta", {seconds: avg})}` : "";
}

// GIF de RÉSULTAT (succès/erreur) en image d'embed : plus grand que l'emoji
// inline, à mi-échelle de l'ancienne version (canvas 96×96). Retourne null
// si le fichier manque — la carte reste en texte seul.
function gifImage(kind) {
  try {
    const file = gifPath(kind);
    if (fs.existsSync(file)) {
      return {files: [{attachment: file, name: `${kind}.gif`}], url: `attachment://${kind}.gif`};
    }
  } catch {}
  return null;
}

// Notification privée (DM) : déclenche une vraie notification push sur
// l'appareil de l'utilisateur. Si les DMs sont désactivés, on échoue
// silencieusement — la carte éphémère dans le salon reste le repli.
async function notifyUser(user, embeds) {
  try { await user.send({embeds}); } catch { /* DMs désactivés : repli salon */ }
}

// Vérification ponctuelle après un échec de sendPower : jusqu'à 3 lectures
// espacées du premier délai de backoff, SANS aucune nouvelle requête power.
// Retourne l'état normalisé si l'objectif est atteint, sinon null.
async function verifyTargetState(serviceId, action, before) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(POLL_DELAYS[0]);
    let s;
    try { s = await get(serviceId, {fresh: true}); }
    catch { continue; }
    const uptimeReset = Number.isFinite(before.uptimeSeconds) && Number.isFinite(s.uptimeSeconds) && s.uptimeSeconds < before.uptimeSeconds;
    const reached = action === "stop" ? offline(s)
      : action === "start" ? online(s)
      : online(s) && (offline(before) || uptimeReset);
    if (reached) return s;
  }
  return null;
}

async function power(i, action, serviceAlias) {
  // Vérification de permission en amont : évite d'exposer l'état du verrou
  // et de monopoliser un slot de confirmation pour un utilisateur non autorisé.
  if (!isAllowed(i.user.id)) {
    const c = t("power.accessDenied");
    await i.editReply(payload(card(c.title, c.body, "bad")));
    return;
  }
  const service = resolveService(serviceAlias);
  // Libellés localisés de l'action : verb (infinitif impératif), cap (début
  // de phrase) et titre de confirmation — ex. fr : Arrêter / Arrêt / « Confirmer l'arrêt ».
  const act = t("power.actions." + action);
  // Nom affiché : celui de l'API si disponible, sinon l'alias (pseudonyme).
  // Lecture non-fresh (cache 5 s partagé avec le watchdog) : un échec n'empêche
  // jamais l'action, l'alias reste le repli.
  let serviceName = service.alias;
  try { serviceName = displayName(await get(service.id), service.alias); } catch { /* alias conservé */ }
  // Relecture du verrou à chaque appel : l'état disque est la source de vérité
  // (un autre processus ou une édition manuelle peut l'avoir modifié).
  const active = loadPersistedLock();
  if (active[service.alias]) {
    const c = t("power.actionInProgress", {action: active[service.alias], name: serviceName});
    await i.editReply(payload(card(c.title, c.body, "wait")));
    return;
  }
  const warning = (action === "stop" || action === "restart") ? t("power.confirm.warning") : "";
  const confirmBody = warning + t("power.confirm.body", {verb: act.verb, name: serviceName});
  if (!await confirm(i, card(act.title, confirmBody, "wait"))) return;

  // Revérification post-confirmation : une révocation pendant l'attente doit prendre effet.
  if (!isAllowed(i.user.id)) {
    const c = t("power.accessRevoked");
    await i.editReply(payload(card(c.title, c.body, "bad")));
    return;
  }
  // Relecture : une autre action a pu démarrer pendant la confirmation.
  const activeNow = loadPersistedLock();
  if (activeNow[service.alias]) {
    const c = t("power.busy", {name: serviceName});
    await i.editReply(payload(card(c.title, c.body, "wait")));
    return;
  }

  writeLock(service.alias, action);
  const actionStart = Date.now();
  try {
    // Vérification d'état AVANT d'afficher le loader : pas de GIF de
    // chargement quand il n'y a rien à faire.
    const before = await get(service.id, {fresh: true});
    if ((action === "start" && online(before)) || (action === "stop" && offline(before))) {
      const c = t("power.alreadyInTargetState", {state: state(before)});
      const eImg = gifImage("error");
      const e = card(c.title, c.body, "good");
      if (eImg) e.setImage(eImg.url);
      await i.editReply(payload(e, [], eImg ? eImg.files : []));
      return;
    }
    // Loader de TRANSMISSION en image d'embed (grande, centrée, mi-échelle
    // 96×96) sur la carte « Traitement » — le GIF s'anime de lui-même.
    const tImg = gifImage("loading");
    if (tImg) {
      const cp = t("confirm.processing");
      const e = card(cp.title, cp.body, "wait");
      e.setImage(tImg.url);
      await i.editReply(payload(e, [], tImg.files));
    }
    let sendError = null;
    const powerStart = Date.now();
    try {
      await sendPower(service.id, action);
      logger.info(t("audit.powerSendOk", {action, alias: service.alias, ms: Date.now() - powerStart}));
    } catch (err) {
      // Le POST a pu être exécuté côté provider malgré l'erreur (timeout, 5xx
      // après exécution…). On ne déclare JAMAIS l'échec sans vérifier l'état
      // réel : seule une LECTURE est ajoutée, aucune seconde requête power.
      sendError = err;
      logger.error(t("audit.powerSendFailed", {action, alias: service.alias, error: err.message, ms: Date.now() - powerStart}));
    }
    // Le cache contient l'état pré-POST : il doit être invalidé même en cas
    // d'erreur, sinon un /status suivant servirait un état obsolète.
    clearCache(service.id);

    if (sendError) {
      // Rien n'a pu être transmis (rejet 4xx, réseau injoignable…) : erreur
      // immédiate — errorText dira explicitement que rien n'a été envoyé.
      if (!mayHaveBeenTransmitted(sendError)) throw sendError;
      // L'action a PU être transmise (timeout, 5xx après exécution…) :
      // vérification rapide de l'état réel…
      const confirmed = await verifyTargetState(service.id, action, before);
      if (confirmed) {
        logger.info(t("audit.powerAppliedDespiteError", {action, alias: service.alias, state: state(confirmed)}));
        const c = t("power.appliedDespiteError", {cap: act.cap, state: state(confirmed), provider: cfg.provider_label});
        record(action, Date.now() - actionStart);
        const sImg = gifImage("success");
        const e = card(c.title, c.body, "good");
        if (sImg) e.setImage(sImg.url);
        const done = payload(e, [], sImg ? sImg.files : []);
        await i.editReply(done);
        await notifyUser(i.user, done.embeds);
        return;
      }
      // …puis bascule sur le suivi silencieux normal (jusqu'à 10 min) plutôt
      // que de déclarer un échec alors que le serveur est peut-être en train
      // de changer d'état. Aucune seconde requête power n'est jamais envoyée.
      logger.warn(t("audit.powerSendErrorPolling", {action, alias: service.alias, error: sendError.message}));
    }
    logger.info(t("audit.powerRequested", {action, username: i.user.username, userId: shortId(i.user.id), alias: service.alias}));

    const start = Date.now(), timeout = TRACKING_TIMEOUT_MS;
    let transition = false, stable = 0, lastKnown = before, failures = 0, iteration = 0;
    const ca = sendError
      ? t("power.acceptedAfterError", {cap: act.cap})
      : t("power.accepted");
    // Loader d'ATTENTE en image d'embed + estimation de durée + bouton
    // d'annulation du suivi. L'action reste irréversible (la requête est
    // déjà partie) : on arrête seulement la surveillance.
    const wImg = gifImage("waiting");
    const cancelId = `pw:${crypto.randomUUID()}:cancel`;
    const cancelRow = new ActionRowBuilder().addComponents(button(cancelId, t("power.cancelTracking"), ButtonStyle.Secondary));
    const ack = card(ca.title, ca.body + etaLine(action));
    if (wImg) ack.setImage(wImg.url);
    const msg = await i.editReply(payload(ack, [cancelRow], wImg ? wImg.files : []));
    let cancelClick = null;
    const cancelPromise = new Promise((resolve) => {
      msg.awaitMessageComponent({time: timeout, filter: (x) => x.user.id === i.user.id && x.customId === cancelId})
        .then((click) => resolve(click), () => resolve(null));
    });
    let cancelled = false;

    while (Date.now() - start < timeout) {
      const delay = POLL_DELAYS[Math.min(iteration, POLL_DELAYS.length - 1)];
      iteration++;
      // Chaque période de sommeil est en course avec le clic d'annulation.
      const woke = await Promise.race([
        sleep(delay).then(() => "poll"),
        cancelPromise.then((click) => { if (click) cancelClick = click; return click ? "cancel" : "poll"; }),
      ]);
      if (woke === "cancel") { cancelled = true; break; }
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
          cap: act.cap,
          provider: cfg.provider_label,
          state: state(s).toUpperCase(),
          seconds,
        }) + tail;
        const cc = t("power.completed");
        record(action, Date.now() - actionStart);
        const sImg = gifImage("success");
        const e = card(cc.title, body, "good");
        if (sImg) e.setImage(sImg.url);
        const done = payload(e, [], sImg ? sImg.files : []);
        await i.editReply(done);
        // Notification de fin : DM privé (notification push sur l'appareil).
        await notifyUser(i.user, done.embeds);
        return;
      }
    }
    if (cancelled) {
      if (cancelClick) await cancelClick.deferUpdate();
      logger.info(t("audit.powerTrackingCancelled", {action, alias: service.alias}));
      const ck = t("power.trackingCancelled");
      await i.editReply(payload(card(ck.title, ck.body)));
      return;
    }
    logger.warn(t("audit.powerNotConfirmed", {action, alias: service.alias, failures}));
    const nc = t("power.notConfirmed");
    const ncBody = sendError
      ? t("power.notConfirmed.bodyTransmitError", {state: state(lastKnown)})
      : failures >= 5
        ? t("power.notConfirmed.bodyFailed", {state: state(lastKnown)})
        : t("power.notConfirmed.bodyTimeout", {state: state(lastKnown)});
    const eImg = gifImage("error");
    const e = card(nc.title, ncBody, "wait");
    if (eImg) e.setImage(eImg.url);
    const ndone = payload(e, [], eImg ? eImg.files : []);
    await i.editReply(ndone);
    await notifyUser(i.user, ndone.embeds);
  } finally {
    recordLockRelease(service.alias);
    clearLock(service.alias);
  }
}

module.exports = {power};
