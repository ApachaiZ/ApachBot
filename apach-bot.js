"use strict";
const logger = require("./lib/logger");
const {ensureEnv} = require("./lib/setup");

let client = null;
let stopWatchdog = null;

async function main() {
  await ensureEnv({nonInteractive: process.argv.includes("--non-interactive")});

  // Chargés APRÈS ensureEnv pour que dotenv lise le .env tout juste écrit.
  const {Client, GatewayIntentBits} = require("discord.js");
  const {cfg} = require("./lib/config");
  const {deployCommandsIfNeeded} = require("./lib/deploy");
  const {handleInteraction} = require("./lib/interaction");
  const {refreshMembers} = require("./lib/members");
  const {start: startWatchdog, stop: stopWatchdogFn} = require("./lib/watchdog");
  const {lang} = require("./lib/i18n");
  stopWatchdog = stopWatchdogFn;

  // GuildMembers (intent privilégié) est requis pour que le sélecteur de
  // membres de /users add|remove liste TOUS les membres de la guilde : sans
  // lui, Discord n'y expose que l'utilisateur qui a lancé la commande.
  // Il doit aussi être activé dans le portail développeur :
  // Bot → Privileged Gateway Intents → SERVER MEMBERS INTENT.
  client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]});
  client.on("interactionCreate", handleInteraction);

  await deployCommandsIfNeeded();
  client.once("clientReady", async () => {
    logger.banner([
      `🎮  APACH • GAME CONTROL`,
      `👤  ${client.user.tag}`,
      `🎯  services: ${Object.keys(cfg.services).join(", ")}`,
      `🌐  language: ${lang}`,
      `💻  node ${process.version}  •  pid ${process.pid}`,
      `📅  ${new Date().toISOString().replace("T", " ").slice(0, 19)}`,
    ]);
    // Précharge les membres de la guilde (menu /users) via la politique de
    // cooldown persistant de lib/members.js : pas d'opcode 8 en rafale lors
    // de redémarrages rapprochés (rate-limit Discord).
    const guild = client.guilds.cache.get(String(cfg.guild_id));
    if (guild) await refreshMembers(guild);
  });
  await client.login(cfg.token);
  startWatchdog(client);
}

process.on("unhandledRejection", (err) => logger.error("Unhandled rejection:", err));
process.on("uncaughtException", (err) => logger.error("Uncaught exception:", err));

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down…`);
  try {
    if (stopWatchdog) stopWatchdog();
    if (client) await client.destroy();
  } catch {}
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((err) => {
  logger.error("Startup failed:", err.message);
  // exitCode 78 (EX_CONFIG) : PM2 ne redémarre pas (stop_exit_codes).
  process.exit(err.exitCode || 1);
});
