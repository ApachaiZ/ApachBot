"use strict";
const {EmbedBuilder, ButtonBuilder, ButtonStyle} = require("discord.js");
const {t} = require("./i18n");

const color = {good: 0x2ecc71, bad: 0xe74c3c, info: 0x5865f2, wait: 0xf1c40f};

function card(title, text, tone = "info", footer = "APACH • GAME CONTROL") {
  return new EmbedBuilder()
    .setColor(color[tone])
    .setTitle(title)
    .setDescription(text)
    .setFooter({text: footer})
    .setTimestamp();
}

const payload = (embed, components = []) => ({embeds: [embed], components, allowedMentions: {parse: []}});
const button = (id, label, style) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

function state(s) { return String(s.state || "unknown").toLowerCase(); }
// "online" est accepté en défense : le contrat provider impose "running",
// mais un futur provider pourrait laisser passer "online" brut.
function online(s) { return ["running", "online"].includes(state(s)); }
function offline(s) { return ["offline", "stopped"].includes(state(s)); }

const fmt = (n) => (Number.isFinite(Number(n)) && n !== null ? Number(n).toLocaleString("en-US") : "N/A");

function bar(used, max) {
  if (!max || used == null) return "Not reported";
  const p = Math.max(0, Math.min(100, used / max * 100));
  return "▰".repeat(Math.round(p / 10)) + "▱".repeat(10 - Math.round(p / 10)) + ` ${p.toFixed(1)}%`;
}

function dashboard(s) {
  const status = state(s);
  const notReported = t("status.notReported");
  const e = card(t("status.title", {name: s.name || t("status.fallbackName")}),
    `${online(s) ? "🟢" : offline(s) ? "🔴" : "🟡"} **${status.toUpperCase()}**`,
    online(s) ? "good" : offline(s) ? "bad" : "wait");
  e.addFields(
    {name: t("status.cpu"), value: `${fmt(s.cpuPct)}%`, inline: true},
    {name: t("status.players"), value: s.players == null ? notReported : String(s.players), inline: true},
    {name: t("status.uptime"), value: s.uptimeSeconds == null ? notReported : `${Math.floor(s.uptimeSeconds / 3600)}h ${Math.floor(s.uptimeSeconds % 3600 / 60)}m`, inline: true},
    {name: t("status.memory"), value: `${fmt(s.ramMb)} / ${fmt(s.ramMaxMb)} MB\n${bar(s.ramMb, s.ramMaxMb)}`},
    {name: t("status.storage"), value: `${fmt(s.diskMb)} / ${fmt(s.diskMaxMb)} MB\n${bar(s.diskMb, s.diskMaxMb)}`},
    {name: t("status.address"), value: s.address ? `${s.address.ip}:${s.address.port}` : notReported, inline: true},
    {name: t("status.node"), value: String(s.node || notReported), inline: true}
  );
  return e;
}

module.exports = {color, card, payload, button, state, online, offline, fmt, bar, dashboard};
