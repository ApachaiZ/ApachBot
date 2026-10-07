"use strict";
const {cfg} = require("./config");
const {get} = require("./api");
const {state, card} = require("./embeds");
const {readLockSnapshot, lockReleaseTime} = require("./state");
const {displayName} = require("./services");
const {t} = require("./i18n");
const logger = require("./logger");

const DEFAULT_INTERVAL_MS = 60_000;
const ALERT_COOLDOWN_MS = 15 * 60_000;
const CPU_THRESHOLD = 90;
const RAM_THRESHOLD = 90;
const DISK_THRESHOLD = 90;
// Après la fin d'une action power volontaire (/stop par ex.), une transition
// running → arrêt est attendue : on ignore les alertes crash pendant ce délai.
const CRASH_GRACE_MS = 5 * 60_000;

let client = null;
let timer = null;
let initialTimer = null;
let running = false;
const lastState = {};
const lastAlert = {};

function canAlert(key) {
  const now = Date.now();
  if (!lastAlert[key] || now - lastAlert[key] > ALERT_COOLDOWN_MS) {
    lastAlert[key] = now;
    return true;
  }
  return false;
}

async function sendAlert(title, description, tone) {
  if (!client || !cfg.alert_channel_id) return;
  try {
    // Consulter le cache Discord d'abord : évite un aller-retour REST à chaque
    // alerte. Le cache est peuplé par les interactions normales du bot.
    const ch = client.channels.cache.get(cfg.alert_channel_id)
      || await client.channels.fetch(cfg.alert_channel_id);
    if (!ch || typeof ch.send !== "function") return;
    await ch.send({embeds: [card(title, description, tone, "APACH • WATCHDOG")], allowedMentions: {parse: []}});
    logger.warn(t("audit.watchdogAlertSent", {title}));
  } catch (err) {
    logger.error(t("audit.watchdogAlertFailed", {error: err.message}));
  }
}

async function checkService(alias, serviceId) {
  const s = await get(serviceId);
  const cur = state(s);
  const prev = lastState[alias];
  // Nom affiché : celui de l'API si disponible, sinon l'alias (pseudonyme).
  const name = displayName(s, alias);

  if (prev === "running" && cur !== "running") {
    // Lecture seule : on ne veut pas qu'un scan de surveillance réécrive active.lock.
    const locks = readLockSnapshot();
    // Délai de grâce : ne pas crier au crash juste après un arrêt volontaire.
    const inGrace = Date.now() - lockReleaseTime(alias) < CRASH_GRACE_MS;
    if (!locks[alias] && !inGrace && canAlert(`${alias}:crash`)) {
      const addr = s.address ? `${s.address.ip}:${s.address.port}` : "unknown";
      await sendAlert(
        t("watchdog.down.title", {name}),
        t("watchdog.down.body", {state: cur, address: addr, provider: cfg.provider_label}),
        "bad"
      );
    }
  }

  const cpu = Number(s.cpuPct);
  if (Number.isFinite(cpu) && cpu > CPU_THRESHOLD && canAlert(`${alias}:cpu`)) {
    await sendAlert(
      t("watchdog.highCpu.title", {name}),
      t("watchdog.highCpu.body", {pct: cpu.toFixed(1), threshold: CPU_THRESHOLD}),
      "wait"
    );
  }
  if (Number.isFinite(s.ramMb) && Number.isFinite(s.ramMaxMb) && s.ramMaxMb > 0) {
    const pct = s.ramMb / s.ramMaxMb * 100;
    if (pct > RAM_THRESHOLD && canAlert(`${alias}:ram`)) {
      await sendAlert(
        t("watchdog.highRam.title", {name}),
        t("watchdog.highRam.body", {pct: pct.toFixed(1), used: s.ramMb, max: s.ramMaxMb}),
        "wait"
      );
    }
  }
  if (Number.isFinite(s.diskMb) && Number.isFinite(s.diskMaxMb) && s.diskMaxMb > 0) {
    const pct = s.diskMb / s.diskMaxMb * 100;
    if (pct > DISK_THRESHOLD && canAlert(`${alias}:disk`)) {
      await sendAlert(
        t("watchdog.highDisk.title", {name}),
        t("watchdog.highDisk.body", {pct: pct.toFixed(1), used: s.diskMb, max: s.diskMaxMb}),
        "wait"
      );
    }
  }

  lastState[alias] = cur;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await Promise.all(Object.entries(cfg.services).map(async ([alias, serviceId]) => {
      try { await checkService(alias, serviceId); }
      catch (err) { logger.error(t("audit.watchdogCheckFailed", {alias, error: err.message})); }
    }));
  } finally { running = false; }
}

function start(discordClient) {
  client = discordClient;
  if (!cfg.alert_channel_id) {
    logger.info(t("audit.watchdogDisabled"));
    return;
  }
  const ms = Number(cfg.alert_interval_ms) > 0 ? Number(cfg.alert_interval_ms) : DEFAULT_INTERVAL_MS;
  logger.info(t("audit.watchdogStarted", {interval: ms, channel: cfg.alert_channel_id}));
  initialTimer = setTimeout(tick, 15_000);
  timer = setInterval(tick, ms);
}

function stop() {
  if (initialTimer) { clearTimeout(initialTimer); initialTimer = null; }
  if (timer) { clearInterval(timer); timer = null; }
  client = null;
}

module.exports = {start, stop, checkService, canAlert};
