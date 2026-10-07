"use strict";
const {MessageFlags, Collection} = require("discord.js");
const {cfg} = require("./config");
const {card, payload} = require("./embeds");
const {confirm} = require("./confirm");
const {isOwner, getUsers, save} = require("./state");
const {t} = require("./i18n");
const {refreshMembers, readPersistedRoster} = require("./members");
const logger = require("./logger");
const {shortId} = logger;

// Pseudo Discord d'un membre, ou null s'il n'est plus joignable (a quitté le\n// serveur, cache incomplet…). L'appelant retombe alors sur l'ID numérique.
async function memberName(i, id) {
  const member = await i.guild.members.fetch(id).catch(() => null);
  return member ? member.user.username : null;
}

// Roster pour l'autocomplétion, dans l'ordre de préférence :
//   1. cache en mémoire (rempli au démarrage, tenu à jour par le gateway) ;
//   2. liste PERSISTÉE sur disque — disponible immédiatement, sans aucun appel
//      gateway, même après un redémarrage ou pendant un quota épuisé ;
//   3. rechargement complet, uniquement si le cooldown opcode 8 le permet
//      (politique centralisée dans lib/members.js).
async function rosterFor(i) {
  await refreshMembers(i.guild);
  if (i.guild.members.cache.size > 0) return i.guild.members.cache;
  const persisted = readPersistedRoster();
  if (persisted.length === 0) return new Collection();
  // Pseudo-membres à partir de la liste persistée : seuls id et username
  // sont exploités pour construire les suggestions.
  return new Collection(persisted.map((m) => [m.id, {id: m.id, user: {bot: false, username: m.username}}]));
}

// ── Autocomplétion de l'option « membre » ────────────────────────────────
// Contrairement au sélecteur de Discord (non filtrable par le bot), c'est ICI
// que les suggestions sont produites : seul le bot décide qui apparaît.
// Source principale : la recherche de membres REST de Discord (même moteur que
// la barre de recherche du serveur) — données toujours à jour, AUCUN appel
// gateway opcode 8, donc ni attente ni saturation de quota. Repli sur le
// cache/le roster persisté si la recherche échoue (intent manquant…).
async function handleMemberAutocomplete(i) {
  if (i.commandName !== "users") return;
  const sub = i.options.getSubcommand();
  if (sub !== "add" && sub !== "remove") return;
  const typed = String(i.options.getFocused() || "").trim().toLowerCase();
  const users = getUsers();
  const valid = (m) => !m.user.bot && !isOwner(m.id)
    && (sub === "add" ? !users.includes(m.id) : users.includes(m.id));

  let members;
  let fromRoster = false;
  if (typed) {
    try {
      members = await i.guild.members.search({query: typed, limit: 25});
    } catch {
      // Recherche REST indisponible : repli sur le cache/le roster persisté.
      members = await rosterFor(i);
      fromRoster = true;
    }
  } else {
    // Champ vide : la liste complète (filtrée) depuis le cache/persisté.
    members = await rosterFor(i);
    fromRoster = true;
  }
  const validMembers = members.filter(valid);
  // La recherche REST matche déjà la frappe (pseudo ou surnom) ; le filtre
  // local n'est nécessaire que pour le repli roster.
  const matches = (fromRoster
    ? validMembers.filter((m) => m.user.username.toLowerCase().includes(typed))
    : validMembers)
    .sort((a, b) => a.user.username.localeCompare(b.user.username, undefined, {sensitivity: "base"}))
    .first(25);
  await i.respond(matches.map((m) => ({name: m.user.username, value: m.id})));
}

async function manage(i) {
  if (!isOwner(i.user.id)) {
    const c = t("manage.accessDenied");
    await i.editReply(payload(card(c.title, c.body, "bad")));
    return;
  }
  const sub = i.options.getSubcommand();
  const users = getUsers();

  if (sub === "list") {
    // Pseudos affichés plutôt que des IDs bruts : plus lisible pour un humain.
    const owner = (await memberName(i, cfg.owner_id)) || cfg.owner_id;
    const header = t("manage.list.header", {owner});
    const entries = [];
    for (const id of users) {
      entries.push(t("manage.list.entry", {name: (await memberName(i, id)) || id}));
    }
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
      logger.info(t("audit.operatorsCleared", {ownerId: shortId(i.user.id)}));
      await i.editReply(payload(card(t("manage.clear.doneTitle"), t("manage.clear.doneBody"), "good")));
    }
    return;
  }

  // add / remove : l'option « membre » (string + autocomplétion) porte l'ID
  // du membre choisi parmi les suggestions filtrables du bot.
  let targetId = null;
  try { targetId = i.options.getString("member", false); } catch { targetId = null; }
  if (!targetId) {
    // Le client exécute encore une ANCIENNE définition de commande (sans
    // l'option) : Discord met parfois plusieurs minutes à rafraîchir les
    // commandes slash côté appli.
    const c = t("manage.staleCommand");
    await i.editReply(payload(card(c.title, c.body, "wait")));
    return;
  }
  const member = await i.guild.members.fetch(targetId).catch(() => null);
  if (!member || member.user.bot || isOwner(targetId)) {
    const ci = t("manage.invalid");
    await i.editReply(payload(card(ci.title, ci.body, "bad")));
    return;
  }
  if ((sub === "add" && users.includes(targetId)) || (sub === "remove" && !users.includes(targetId))) {
    const cn = t("manage.noChange");
    const body = sub === "add" ? t("manage.noChange.bodyAdd") : t("manage.noChange.bodyRemove");
    await i.editReply(payload(card(cn.title, body)));
    return;
  }
  const verb = sub === "add" ? t("manage.confirm.verbAdd") : t("manage.confirm.verbRemove");
  const confirmBody = t("manage.confirm.body", {verb, username: member.user.username});
  if (!await confirm(i, card(t("manage.confirm.title"), confirmBody, "wait"))) return;

  if (sub === "add") {
    const still = await i.guild.members.fetch(targetId).catch(() => null);
    if (!still || still.user.bot) throw new Error("Selected member no longer eligible");
  }
  await save(sub === "add" ? [...new Set([...users, targetId])] : users.filter((x) => x !== targetId));
  // Audit anonymisé : pseudo en clair, identifiants tronqués.
  logger.info(t(sub === "add" ? "audit.operatorGranted" : "audit.operatorRevoked", {
    username: member.user.username, target: shortId(targetId), ownerId: shortId(i.user.id),
  }));
  const cd = t("manage.done");
  const doneBody = sub === "add"
    ? t("manage.done.bodyAdd", {username: member.user.username})
    : t("manage.done.bodyRemove", {username: member.user.username});
  await i.editReply(payload(card(cd.title, doneBody, "good")));
}

module.exports = {manage, handleMemberAutocomplete};
