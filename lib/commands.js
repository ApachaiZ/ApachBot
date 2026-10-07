"use strict";
const {SlashCommandBuilder, InteractionContextType} = require("discord.js");
const {cfg} = require("./config");
const logger = require("./logger");

// Discord limite à 25 choix par option. Au-delà, les services surnuméraires
// deviennent invisibles dans les commandes ET dans /server : ils ne peuvent
// plus être ciblés du tout. On avertit au démarrage pour rendre le problème
// visible plutôt que silencieux.
const MAX_SERVICE_CHOICES = 25;
const allServices = Object.entries(cfg.services);
if (allServices.length > MAX_SERVICE_CHOICES) {
  const hidden = allServices.slice(MAX_SERVICE_CHOICES).map(([a]) => a);
  logger.warn(`commands: ${allServices.length} services configured but Discord only allows ${MAX_SERVICE_CHOICES} choices. Hidden: ${hidden.join(", ")}`);
}

const serviceChoices = allServices
  .slice(0, MAX_SERVICE_CHOICES)
  .map(([alias, id]) => ({name: `${alias} (${id})`, value: alias}));

function withService(builder) {
  return builder.addStringOption((o) => o
    .setName("service")
    .setDescription("Target game server (defaults to your session service, then the primary one)")
    .setRequired(false)
    .addChoices(...serviceChoices));
}

const commands = [
  ...["status", "start", "stop", "restart"].map((n) => withService(new SlashCommandBuilder()
    .setName(n)
    .setDescription({status: "View game server status", start: "Start the game server", stop: "Stop the game server", restart: "Restart the game server"}[n])
    .setContexts(InteractionContextType.Guild))),
  new SlashCommandBuilder().setName("users").setDescription("Manage authorized server operators").setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("add").setDescription("Authorize a Discord member")
      .addStringOption((o) => o.setName("member").setDescription("Member to authorize (type to search)").setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName("remove").setDescription("Revoke a Discord member")
      .addStringOption((o) => o.setName("member").setDescription("Member to revoke (type to search)").setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName("list").setDescription("List authorized operators"))
    .addSubcommand((s) => s.setName("clear").setDescription("Revoke all operators except the owner")),
  withService(new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Measure API latency for a game server")
    .setContexts(InteractionContextType.Guild)),
  new SlashCommandBuilder().setName("logs").setDescription("View the last log lines (owner only)").setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName("filter").setDescription("Only show lines containing this text").setRequired(false)),
  new SlashCommandBuilder().setName("help").setDescription("View commands and permissions").setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName("server")
    .setDescription("Select the default game server for your session")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o
      .setName("service")
      .setDescription("Game server to use by default")
      .setRequired(true)
      .addChoices(...serviceChoices)),
];

module.exports = {commands};
