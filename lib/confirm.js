"use strict";
const crypto = require("node:crypto");
const {ActionRowBuilder, ButtonStyle} = require("discord.js");
const {card, payload, button} = require("./embeds");
const {t} = require("./i18n");

async function confirm(interaction, embed) {
  const id = crypto.randomUUID();
  // Préfixe lisible pour faciliter le debug côté Discord (customId visible
  // dans les logs d'interaction) : "cnf:<uuid>:yes" / "cnf:<uuid>:no".
  const yesId = `cnf:${id}:yes`;
  const noId = `cnf:${id}:no`;
  const row = new ActionRowBuilder().addComponents(
    button(yesId, t("confirm.confirm"), ButtonStyle.Danger),
    button(noId, t("confirm.cancel"), ButtonStyle.Secondary)
  );
  const msg = await interaction.editReply(payload(embed, [row]));
  try {
    const c = await msg.awaitMessageComponent({time: 60000, filter: (x) => x.user.id === interaction.user.id && [yesId, noId].includes(x.customId)});
    await c.deferUpdate();
    if (c.customId === noId) {
      const cc = t("confirm.cancelled");
      await interaction.editReply(payload(card(cc.title, cc.body)));
      return false;
    }
    const cp = t("confirm.processing");
    await interaction.editReply(payload(card(cp.title, cp.body, "wait")));
    return true;
  } catch {
    // Retirer les boutons pour éviter un clic sur une interaction expirée.
    try { await msg.edit({components: []}); } catch {}
    const ce = t("confirm.expired");
    await interaction.editReply(payload(card(ce.title, ce.body, "wait")));
    return false;
  }
}

module.exports = {confirm};
