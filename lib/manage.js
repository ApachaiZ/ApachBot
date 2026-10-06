"use strict";
const crypto = require("node:crypto");
const {ActionRowBuilder, UserSelectMenuBuilder, MessageFlags} = require("discord.js");
const {cfg} = require("./config");
const {card, payload} = require("./embeds");
const {confirm} = require("./confirm");
const {isOwner, getUsers, save} = require("./state");
const {t} = require("./i18n");
const logger = require("./logger");

async function manage(i) {
  if (!isOwner(i.user.id)) {
    const c = t("manage.accessDenied");
    await i.editReply(payload(card(c.title, c.body, "bad")));
    return;
  }
  const sub = i.options.getSubcommand();
  const users = getUsers();

  if (sub === "list") {
    const header = t("manage.list.header", {ownerId: cfg.owner_id});
    const entries = users.map((id) => t("manage.list.entry", {id}));
    const pageSize = 20;
    const pages = [];
    for (let n = 0; n < entries.length; n += pageSize) pages.push(entries.slice(n, n + pageSize));
    if (pages.length === 0) pages.push([]);
    for (let p = 0; p < pages.length; p++) {
      const body = [header, ...pages[p]].join("\n");
      const title = pages.length > 1
        ? t("manage.list.titleMany", {page: p + 1, totalPages: pages.length})
        : t("manage.list.titleOne");
      const pl = payload(card(title, body));
      if (p === 0) await i.editReply(pl);
      else await i.followUp({...pl, flags: MessageFlags.Ephemeral});
    }
    return;
  }

  if (sub === "clear") {
    if (await confirm(i, card(t("manage.clear.confirmTitle"), t("manage.clear.confirmBody"), "wait"))) {
      await save([]);
      logger.info(t("audit.operatorsCleared", {ownerId: i.user.id}));
      await i.editReply(payload(card(t("manage.clear.doneTitle"), t("manage.clear.doneBody"), "good")));
    }
    return;
  }

  const id = crypto.randomUUID();
  const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder()
    .setCustomId(id).setPlaceholder(t("manage.select.placeholder")).setMinValues(1).setMaxValues(1));
  const selectBody = sub === "add" ? t("manage.select.bodyAdd") : t("manage.select.bodyRemove");
  const msg = await i.editReply(payload(card(t("manage.select.title"), selectBody), [row]));

  let c;
  try {
    c = await msg.awaitMessageComponent({time: 90000, filter: (x) => x.user.id === i.user.id && x.customId === id});
    await c.deferUpdate();
  } catch {
    const ce = t("manage.expired");
    await i.editReply(payload(card(ce.title, ce.body, "wait")));
    return;
  }

  const target = c.values[0];
  const member = await i.guild.members.fetch(target).catch(() => null);
  if (!member || member.user.bot || isOwner(target)) {
    const ci = t("manage.invalid");
    await i.editReply(payload(card(ci.title, ci.body, "bad")));
    return;
  }
  if ((sub === "add" && users.includes(target)) || (sub === "remove" && !users.includes(target))) {
    const cn = t("manage.noChange");
    const body = sub === "add" ? t("manage.noChange.bodyAdd") : t("manage.noChange.bodyRemove");
    await i.editReply(payload(card(cn.title, body)));
    return;
  }
  const verb = sub === "add" ? t("manage.confirm.verbAdd") : t("manage.confirm.verbRemove");
  const confirmBody = t("manage.confirm.body", {verb, target, username: member.user.username});
  if (!await confirm(i, card(t("manage.confirm.title"), confirmBody, "wait"))) return;

  if (sub === "add") {
    const still = await i.guild.members.fetch(target).catch(() => null);
    if (!still || still.user.bot) throw new Error("Selected member no longer eligible");
  }
  await save(sub === "add" ? [...new Set([...users, target])] : users.filter((x) => x !== target));
  logger.info(t(sub === "add" ? "audit.operatorGranted" : "audit.operatorRevoked", {target, ownerId: i.user.id}));
  const cd = t("manage.done");
  const doneBody = sub === "add" ? t("manage.done.bodyAdd", {target}) : t("manage.done.bodyRemove", {target});
  await i.editReply(payload(card(cd.title, doneBody, "good")));
}

module.exports = {manage};
