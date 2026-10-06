"use strict";
const fs = require("node:fs");
const {logFile} = require("./paths");
const {card, payload} = require("./embeds");
const {isOwner} = require("./state");
const {t} = require("./i18n");
const MAX_LINES = 30;
const MAX_CHARS = 1800;
const FILTER_SCAN = 2000;

// Lit l'intégralité du fichier puis retourne les N dernières lignes non vides.
// Acceptable à l'échelle actuelle (rotation à 5 Mo). À réimplémenter par
// lecture arrière de blocs si le volume augmente significativement.
function readTail(file, maxLines) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  return lines.slice(-maxLines);
}

async function logs(i) {
  if (!isOwner(i.user.id)) {
    const c = t("logs.accessDenied");
    await i.editReply(payload(card(c.title, c.body, "bad")));
    return;
  }

  const filter = (i.options.getString("filter") || "").trim().toLowerCase();

  let lines;
  try {
    lines = readTail(logFile, filter ? FILTER_SCAN : MAX_LINES);
  } catch (err) {
    const msg = err.code === "ENOENT"
      ? t("logs.notFound")
      : t("logs.readFailed", {code: err.code || err.message});
    await i.editReply(payload(card(t("logs.cardTitle"), msg, "wait")));
    return;
  }

  if (filter) {
    lines = lines.filter((l) => l.toLowerCase().includes(filter)).slice(-MAX_LINES);
  }

  if (lines.length === 0) {
    const msg = filter ? t("logs.nothingFiltered", {filter}) : t("logs.empty");
    await i.editReply(payload(card(t("logs.cardTitle"), msg, "wait")));
    return;
  }

  let body = lines.join("\n");
  if (body.length > MAX_CHARS) body = "…\n" + body.slice(-MAX_CHARS);

  const title = filter
    ? t("logs.titleFiltered", {count: lines.length, filter})
    : t("logs.titleLast", {count: lines.length});

  await i.editReply(payload(card(title, "```\n" + body + "\n```")));
}

module.exports = {logs};
