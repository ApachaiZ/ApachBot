"use strict";
const path = require("node:path");

// Module feuille : ne dépend d'aucun autre module du projet (évite les cycles
// avec config.js). Charge dotenv directement pour lire .apach/.env.
const envFile = path.join(__dirname, "..", ".apach", ".env");
require("dotenv").config({path: envFile});

const SUPPORTED = ["en", "fr"];
const DEFAULT_LANG = "en";

// Résolution en cascade : --lang=xx > BOT_LANGUAGE > défaut.
function resolveInitialLang() {
  const arg = process.argv.find((a) => a.startsWith("--lang="));
  if (arg) {
    const code = arg.slice("--lang=".length).trim().toLowerCase();
    if (SUPPORTED.includes(code)) return code;
    process.stderr.write(`[i18n] Unknown --lang value "${code}", falling back to "${DEFAULT_LANG}".\n`);
  }
  const env = String(process.env.BOT_LANGUAGE || "").trim().toLowerCase();
  if (SUPPORTED.includes(env)) return env;
  if (env) process.stderr.write(`[i18n] Unknown BOT_LANGUAGE "${env}", falling back to "${DEFAULT_LANG}".\n`);
  return DEFAULT_LANG;
}

let currentLang = resolveInitialLang();
let catalog = require(`./locales/${currentLang}`);
const fallback = require("./locales/en");

function lookup(obj, key) {
  const parts = key.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

// Interpolation récursive : les feuilles de type chaîne sont interpolées, les
// objets (ex. {title, body}) sont traversés. Sans cela, un appel
// `t("ping.pong", {alias, ms}).body` renverrait les placeholders littéraux
// {alias}/{ms} : c'est pourtant le pattern utilisé par ping.js, power.js et
// interaction.js (carte lue après coup via c.title / c.body).
function interpolate(value, params) {
  if (typeof value === "string") {
    return value.replace(/\{(\w+)\}/g, (m, name) => {
      if (Object.prototype.hasOwnProperty.call(params, name)) return String(params[name]);
      return m;
    });
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, params));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v, params);
    return out;
  }
  return value;
}

function t(key, params = {}) {
  let value = lookup(catalog, key);
  if (value === undefined) value = lookup(fallback, key);
  if (value === undefined) return key;
  return interpolate(value, params);
}

function setLanguage(code) {
  const c = String(code || "").trim().toLowerCase();
  if (!SUPPORTED.includes(c)) return false;
  if (c === currentLang) return true;
  currentLang = c;
  catalog = require(`./locales/${c}`);
  return true;
}

module.exports = {
  t,
  setLanguage,
  get lang() { return currentLang; },
  availableLanguages: SUPPORTED,
};
