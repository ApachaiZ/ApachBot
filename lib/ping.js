"use strict";
const {card, payload} = require("./embeds");
const {get} = require("./api");
const {resolveService} = require("./config");
const {t} = require("./i18n");

// Mesure la latence aller-retour vers l'API du provider pour un service donné.
// Utilise {fresh: true} pour ne pas être faussé par le cache 5 s.
// Le contrôle de permission est effectué en amont par interaction.js.
async function ping(i, serviceAlias) {
  const service = resolveService(serviceAlias);

  const t0 = Date.now();
  try {
    await get(service.id, {fresh: true});
  } catch (err) {
    const status = err.response?.status;
    const statusPart = status ? t("ping.failed.statusSuffix", {status}) : "";
    const c = t("ping.failed", {alias: service.alias, statusPart});
    await i.editReply(payload(card(c.title, c.body, "bad")));
    return;
  }
  const ms = Date.now() - t0;
  const tone = ms < 300 ? "good" : ms < 1000 ? "wait" : "bad";
  const c = t("ping.pong", {alias: service.alias, ms});
  await i.editReply(payload(card(c.title, c.body, tone)));
}

module.exports = {ping};
