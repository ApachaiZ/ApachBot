"use strict";
const {EmbedBuilder, ButtonBuilder, ButtonStyle} = require("discord.js");
const {t} = require("./i18n");
const {displayName} = require("./services");

const color = {good: 0x2ecc71, bad: 0xe74c3c, info: 0x5865f2, wait: 0xf1c40f};

function card(title, text, tone = "info", footer = "APACH • GAME CONTROL") {
  return new EmbedBuilder()
    .setColor(color[tone])
    .setTitle(title)
    .setDescription(text)
    .setFooter({text: footer})
    .setTimestamp();
}

const payload = (embed, components = [], files = []) => ({
  embeds: [embed],
  components,
  // Sans pièce jointe, on l'explicite : une édition de message ne retire
  // PAS les anciens attachments (le GIF de chargement resterait affiché).
  ...(files.length ? {files} : {attachments: []}),
  allowedMentions: {parse: []},
});
const button = (id, label, style) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

function state(s) { return String(s.state || "unknown").toLowerCase(); }
// "online" est accepté en défense : le contrat provider impose "running",
// mais un futur provider pourrait laisser passer "online" brut.
function online(s) { return ["running", "online"].includes(state(s)); }
function offline(s) { return ["offline", "stopped"].includes(state(s)); }

const fmt = (n) => (Number.isFinite(Number(n)) && n !== null ? Number(n).toLocaleString("en-US") : "N/A");

// Durée lisible, ex. "3h 24m" / "1d 2h". Unités volontairement neutres (d/h/m).
function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor(s % 86400 / 3600);
  const m = Math.floor(s % 3600 / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function bar(used, max) {
  if (!max || used == null) return "Not reported";
  const p = Math.max(0, Math.min(100, used / max * 100));
  return "▰".repeat(Math.round(p / 10)) + "▱".repeat(10 - Math.round(p / 10)) + ` ${p.toFixed(1)}%`;
}

// Tableau de bord /status modulaire : chaque métrique n'apparaît que si le
// provider la renseigne — aucune ligne « Non rapporté » ne vient polluer
// l'affichage. Les barres (CPU/RAM/disque) sont pleine largeur ; joueurs,
// uptime, adresse et nœud se placent côte à côte seulement quand ils vont
// par paire, sinon pleine largeur. L'uptime reste par ailleurs utilisé en
// interne par la logique power (détection de remise à zéro au redémarrage).
function dashboard(s, alias) {
  const notReported = t("status.notReported");
  const tone = online(s) ? "good" : offline(s) ? "bad" : "wait";
  const stateLabel = online(s) ? t("status.stateRunning")
    : offline(s) ? t("status.stateOffline")
    : t("status.stateUnknown");
  const e = card(t("status.title", {name: displayName(s, alias)}), stateLabel, tone);

  const fields = [];
  if (s.cpuPct != null) fields.push({name: t("status.cpu"), value: bar(s.cpuPct, 100), inline: false});
  if (s.ramMb != null && s.ramMaxMb) {
    fields.push({name: t("status.memory"), value: `${fmt(s.ramMb)} / ${fmt(s.ramMaxMb)} MB\n${bar(s.ramMb, s.ramMaxMb)}`, inline: false});
  }
  if (s.diskMb != null && s.diskMaxMb) {
    fields.push({name: t("status.storage"), value: `${fmt(s.diskMb)} / ${fmt(s.diskMaxMb)} MB\n${bar(s.diskMb, s.diskMaxMb)}`, inline: false});
  }

  const chips = [];
  if (s.players != null) chips.push({name: t("status.players"), value: String(s.players)});
  if (s.uptimeSeconds != null) chips.push({name: t("status.uptime"), value: fmtDuration(s.uptimeSeconds)});
  for (const c of chips) fields.push({...c, inline: chips.length > 1});

  const info = [];
  if (s.address) info.push({name: t("status.address"), value: `${s.address.ip}:${s.address.port}`});
  if (s.node) info.push({name: t("status.node"), value: String(s.node)});
  // Séparateur invisible : sans lui, deux paires inline consécutives seraient
  // regroupées par Discord en une grille 3+1 (le 4e champ seul sur sa ligne).
  if (chips.length > 1 && info.length > 1) {
    fields.push({name: "\u200b", value: "\u200b", inline: false});
  }
  for (const f of info) fields.push({...f, inline: info.length > 1});

  if (!fields.length) fields.push({name: t("status.metrics"), value: notReported});
  e.addFields(fields);
  return e;
}

module.exports = {card, payload, button, state, online, offline, fmt, bar, fmtDuration, dashboard};
