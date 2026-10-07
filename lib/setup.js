"use strict";
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const {stdin, stdout} = require("node:process");
const {isUnset} = require("./services");
const {envFile: envPath} = require("./paths");
const {t, setLanguage} = require("./i18n");

// Champs obligatoires. `PROVIDER_SERVICE_ID` et `PROVIDER_SERVICES` sont
// mutuellement alternatifs : l'un OU l'autre doit être fourni.
// `optionalIf` saute le champ si son alternative est déjà présente.
// `optional` (BOT_LANGUAGE) : jamais bloquant — le champ a un défaut côté
// i18n — mais toujours proposé en mode interactif.
// `questionKey` référence une clé du catalogue i18n (résolue au moment du prompt).
// `choices` restreint la saisie à une liste de valeurs (utilisé pour BOT_LANGUAGE).
const FIELDS = [
  {key: "BOT_LANGUAGE",        questionKey: "setup.languageLabel", choices: ["en", "fr"], optional: true},
  {key: "DISCORD_TOKEN",       questionKey: "setup.prompt.discordToken", secret: true},
  {key: "DISCORD_CLIENT_ID",   questionKey: "setup.prompt.discordClientId"},
  {key: "DISCORD_OWNER_ID",    questionKey: "setup.prompt.discordOwnerId"},
  {key: "DISCORD_GUILD_ID",    questionKey: "setup.prompt.discordGuildId"},
  {key: "PROVIDER_API_KEY",    questionKey: "setup.prompt.providerApiKey", secret: true},
  {key: "PROVIDER_SERVICE_ID", questionKey: "setup.prompt.providerServiceId", optionalIf: "PROVIDER_SERVICES", allowEmpty: true},
  {key: "PROVIDER_SERVICES",   questionKey: "setup.prompt.providerServices", optionalIf: "PROVIDER_SERVICE_ID", allowEmpty: true},
];

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) map.set(key, val);
  }
  return map;
}

function readEnv() {
  try { return parseEnv(fs.readFileSync(envPath, "utf8")); }
  catch { return new Map(); }
}

// Réécrit le fichier .env en préservant les commentaires et l'ordre existants.
// Les clés déjà présentes sont mises à jour en place ; les nouvelles sont
// ajoutées à la fin. Les lignes de commentaire et les lignes vides sont
// conservées telles quelles.
function writeEnv(map) {
  fs.mkdirSync(path.dirname(envPath), {recursive: true});

  let existingLines = [];
  try { existingLines = fs.readFileSync(envPath, "utf8").split(/\r?\n/); } catch {}

  const remaining = new Map(map);
  const out = [];
  for (const line of existingLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) { out.push(line); continue; }
    const idx = line.indexOf("=");
    if (idx < 0) { out.push(line); continue; }
    const key = line.slice(0, idx).trim();
    if (remaining.has(key)) {
      out.push(`${key}=${remaining.get(key)}`);
      remaining.delete(key);
    } else {
      out.push(line);
    }
  }
  // Ajouter les clés restantes (nouvelles) à la fin.
  for (const [k, v] of remaining) out.push(`${k}=${v}`);

  // Normaliser : une seule ligne vide finale.
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  out.push("");

  fs.writeFileSync(envPath, out.join("\n"), {mode: 0o600});
  try { fs.chmodSync(envPath, 0o600); } catch {}
}

function askHidden(rl, query) {
  return new Promise((resolve) => {
    const original = rl._writeToOutput;
    rl._writeToOutput = function (s) {
      if (s.includes("\n") || s.includes("\r")) return original.call(rl, s);
      return original.call(rl, "*".repeat(s.length));
    };
    rl.question(query).then((v) => {
      rl._writeToOutput = original;
      stdout.write("\n");
      resolve(v);
    });
  });
}

// Erreur de configuration : le processus sort avec le code 78 (EX_CONFIG,
// sysexits). PM2 est configuré avec stop_exit_codes: [78] pour ne PAS
// redémarrer en boucle sur un problème que seul un humain peut corriger
// (remplir le .env) — contrairement à un crash, qu'on veut relancer.
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
    this.exitCode = 78;
  }
}

async function ensureEnv({nonInteractive = false} = {}) {
  const existing = readEnv();
  const has = (key) => !isUnset(existing.get(key)) || !isUnset(process.env[key]);

  // Champs bloquants : l'absence d'un champ `optional` (BOT_LANGUAGE a un
  // défaut côté i18n) ne doit JAMAIS empêcher le démarrage non-interactif.
  const missing = FIELDS.filter((f) => {
    if (f.optional) return false;
    if (has(f.key)) return false;
    if (f.optionalIf && has(f.optionalIf)) return false;
    return true;
  });
  // Questions du mode interactif : champs bloquants manquants + champs
  // optionnels non renseignés (BOT_LANGUAGE est demandé en premier pour
  // basculer la langue des prompts suivants).
  const unanswered = FIELDS.filter((f) => {
    if (has(f.key)) return false;
    if (f.optionalIf && has(f.optionalIf)) return false;
    return true;
  });

  if (nonInteractive || !stdin.isTTY) {
    // Jamais de prompt ici : on échoue seulement si des champs BLOQUANTS
    // manquent. Les champs optionnels (BOT_LANGUAGE) ont un défaut côté
    // i18n et ne justifient ni erreur ni assistant.
    if (missing.length > 0) {
      const key = nonInteractive ? "errors.setupIncompleteNonInteractive" : "errors.setupIncompleteNoTty";
      // Lister les clés manquantes : sous PM2/systemd, l'utilisateur ne voit
      // que le log — autant lui dire exactement quoi remplir dans le .env.
      const missingKeys = missing.map((f) => f.key).join(", ");
      throw new ConfigError(t(key, {envFile: envPath, missing: missingKeys}));
    }
    return;
  }
  if (unanswered.length === 0) return;

  stdout.write(t("setup.intro"));
  stdout.write(t("setup.fileLine", {envFile: envPath}));

  const rl = readline.createInterface({input: stdin, output: stdout});
  try {
    for (const f of unanswered) {
      let answer = "";
      // allowEmpty : la valeur vide est acceptée dans la boucle. La cohérence
      // (au moins l'une des deux alternatives fournie) est vérifiée APRÈS la
      // boucle complète, car l'alternative peut être demandée plus tard.
      while (true) {
        const question = t(f.questionKey);
        answer = f.secret
          ? await askHidden(rl, t("setup.promptLineHidden", {question}))
          : await rl.question(t("setup.promptLine", {question}));
        answer = answer.trim();
        if (f.choices && !f.choices.includes(answer.toLowerCase())) {
          stdout.write(t("setup.invalid"));
          continue;
        }
        if (!isUnset(answer)) break;
        if (f.allowEmpty) break;
        stdout.write(t("setup.invalid"));
      }
      if (!isUnset(answer)) {
        existing.set(f.key, answer);
        // Bascule immédiate de la langue dès que BOT_LANGUAGE est saisi,
        // pour que les prompts suivants s'affichent dans la bonne langue.
        if (f.key === "BOT_LANGUAGE") setLanguage(answer);
      }
    }
  } finally {
    rl.close();
  }

  // Validation post-boucle : pour chaque champ allowEmpty laissé vide, exiger
  // que son alternative soit présente (dans existing ou process.env).
  for (const f of unanswered) {
    if (!f.allowEmpty) continue;
    if (!isUnset(existing.get(f.key))) continue;
    const alt = f.optionalIf;
    const altOk = alt && (!isUnset(existing.get(alt)) || !isUnset(process.env[alt]));
    if (!altOk) {
      throw new ConfigError(t("errors.setupIncompleteCheck", {key: f.key, alt}));
    }
  }

  // Conserver l'ordre canonique des FIELDS, puis les éventuelles clés supplémentaires.
  const ordered = new Map();
  for (const f of FIELDS) if (existing.has(f.key)) ordered.set(f.key, existing.get(f.key));
  for (const [k, v] of existing) if (!ordered.has(k)) ordered.set(k, v);

  writeEnv(ordered);
  stdout.write(t("setup.complete", {envFile: envPath}));
}

module.exports = {ensureEnv, parseEnv, ConfigError};
