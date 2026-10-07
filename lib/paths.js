"use strict";
const path = require("node:path");

// Source unique de vérité pour la racine du projet.
// Ce module ne doit dépendre d'aucun autre module du projet : il est chargé
// très tôt (avant config.js) et ne doit déclencher aucune validation
// d'environnement ni aucun effet de bord.
const ROOT = path.join(__dirname, "..");

const paths = {
  ROOT,
  envFile: path.join(ROOT, ".apach", ".env"),
  apachDir: path.join(ROOT, ".apach"),
  logsDir: path.join(ROOT, "logs"),
  logFile: path.join(ROOT, "logs", "apach-bot.log"),
  usersFile: path.join(ROOT, ".apach", "users.json"),
  legacyUsersFile: path.join(ROOT, "apach-users.json"),
  sessionsFile: path.join(ROOT, ".apach", "sessions.json"),
  lockFile: path.join(ROOT, ".apach", "active.lock"),
  commandsHashFile: path.join(ROOT, ".apach", "commands.hash"),
  membersStateFile: path.join(ROOT, ".apach", "members.state.json"),
  membersRosterFile: path.join(ROOT, ".apach", "members.roster.json"),
  statsFile: path.join(ROOT, ".apach", "stats.json"),
};

module.exports = paths;
