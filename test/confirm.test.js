"use strict";

// Langue figée avant tout require : les assertions ci-dessous vérifient des
// chaînes anglaises littérales (clés confirm.* de lib/locales/en.js).
process.env.BOT_LANGUAGE = "en";

const test = require("node:test");
const assert = require("node:assert/strict");
const {confirm} = require("../lib/confirm");
const {card} = require("../lib/embeds");

// Mock d'interaction Discord (aucun vrai client) :
// - editReply capture chaque payload ; au premier appel, il construit un faux
//   message à partir des customId des deux boutons ;
// - awaitMessageComponent simule le clic fourni par `onClick` : null = timeout,
//   clic rejeté par le filter = throw (équivalent à un timeout Discord) ;
// - msg.edit est capturé dans `msgEdits` (observable par les assertions).
function mockInteraction(onClick) {
  const editReplies = [];
  const msgEdits = [];
  let msg = null;

  const interaction = {
    user: {id: "u1"},
    editReply: async (payload) => {
      editReplies.push(payload);
      if (msg === null) {
        const yesId = payload.components[0].components[0].data.custom_id;
        const noId = payload.components[0].components[1].data.custom_id;
        msg = {
          awaitMessageComponent: async ({filter}) => {
            const click = onClick(yesId, noId);
            if (click === null) throw new Error("confirmation expirée");
            if (!filter(click)) throw new Error("clic rejeté par le filter");
            return click;
          },
          edit: async (p) => { msgEdits.push(p); },
        };
      }
      return msg;
    },
  };

  return {interaction, editReplies, msgEdits};
}

// Clic simulé sur un bouton (deferUpdate sans effet).
function click(userId, customId) {
  return {user: {id: userId}, customId, deferUpdate: async () => {}};
}

// Lecteurs concis pour les assertions sur les cartes.
const title = (p) => p.embeds[0].data.title;
const description = (p) => p.embeds[0].data.description;

test("confirm: clic yes → true, carte processing, 2 boutons au départ", async () => {
  const {interaction, editReplies} = mockInteraction((yesId) => click("u1", yesId));
  const embed = card("Action", "Corps de la demande");

  const result = await confirm(interaction, embed);

  assert.equal(result, true);
  // Premier payload : l'embed fourni et les deux boutons yes/no.
  const first = editReplies[0];
  assert.equal(first.embeds[0], embed);
  assert.equal(first.components[0].components.length, 2);
  assert.match(first.components[0].components[0].data.custom_id, /^cnf:.+:yes$/);
  assert.match(first.components[0].components[1].data.custom_id, /^cnf:.+:no$/);
  assert.equal(first.components[0].components[0].data.label, "Confirm");
  assert.equal(first.components[0].components[1].data.label, "Cancel");
  // Dernier editReply : carte "processing".
  const last = editReplies.at(-1);
  assert.equal(title(last), "Processing");
  assert.equal(description(last), "Please wait…");
});

test("confirm: clic no → false, carte cancelled", async () => {
  const {interaction, editReplies} = mockInteraction((_yesId, noId) => click("u1", noId));

  const result = await confirm(interaction, card("Action", "Corps de la demande"));

  assert.equal(result, false);
  const last = editReplies.at(-1);
  assert.equal(title(last), "Cancelled");
  assert.equal(description(last), "No changes made.");
});

test("confirm: timeout → false, boutons retirés, carte expired", async () => {
  const {interaction, editReplies, msgEdits} = mockInteraction(() => null);

  const result = await confirm(interaction, card("Action", "Corps de la demande"));

  assert.equal(result, false);
  // Les boutons ont été retirés du message d'origine.
  assert.deepEqual(msgEdits, [{components: []}]);
  const last = editReplies.at(-1);
  assert.equal(title(last), "Expired");
  assert.equal(description(last), "Confirmation expired. Run the command again.");
});

test("confirm: clic d'un autre utilisateur → rejet du filter, même issue qu'un timeout", async () => {
  const {interaction, editReplies, msgEdits} = mockInteraction((yesId) => click("u2", yesId));

  const result = await confirm(interaction, card("Action", "Corps de la demande"));

  assert.equal(result, false);
  assert.deepEqual(msgEdits, [{components: []}]);
  const last = editReplies.at(-1);
  assert.equal(title(last), "Expired");
  assert.equal(description(last), "Confirmation expired. Run the command again.");
});
