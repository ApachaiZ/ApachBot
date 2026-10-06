"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

// Forcer la langue de référence avant tout require du code applicatif.
process.env.BOT_LANGUAGE = "en";

const {t, setLanguage, availableLanguages} = require("../lib/i18n");
// `lang` est un getter : il doit être lu via l'objet module à chaque accès.
// Une déstructuration (`const {lang} = require(...)`) figerait la valeur au require.
const i18n = require("../lib/i18n");
const en = require("../lib/locales/en");
const fr = require("../lib/locales/fr");

// Parcours récursif : retourne la liste des chemins de clés feuilles.
function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

test("i18n: langues supportées", () => {
  assert.deepEqual(availableLanguages, ["en", "fr"]);
});

test("i18n: langue initiale = en (BOT_LANGUAGE forcé)", () => {
  assert.equal(i18n.lang, "en");
});

test("i18n: t() retourne la valeur anglaise", () => {
  assert.equal(t("confirm.confirm"), "Confirm");
});

test("i18n: t() interpole les placeholders", () => {
  const out = t("ping.pong.body", {alias: "main", ms: 42});
  assert.match(out, /main/);
  assert.match(out, /42/);
});

test("i18n: t() laisse les placeholders inconnus intacts", () => {
  const out = t("ping.pong.body", {alias: "main"});
  assert.match(out, /\{ms\}/);
});

test("i18n: t() retourne la clé si introuvable", () => {
  assert.equal(t("does.not.exist"), "does.not.exist");
});

test("i18n: setLanguage bascule vers fr puis revient à en", () => {
  assert.equal(setLanguage("fr"), true);
  assert.equal(i18n.lang, "fr");
  assert.equal(t("confirm.confirm"), "Confirmer");
  assert.equal(setLanguage("en"), true);
  assert.equal(i18n.lang, "en");
  assert.equal(t("confirm.confirm"), "Confirm");
});

test("i18n: setLanguage refuse une langue inconnue", () => {
  assert.equal(setLanguage("de"), false);
  assert.equal(i18n.lang, "en");
});

test("i18n: parité stricte en.js ↔ fr.js", () => {
  const enKeys = collectKeys(en).sort();
  const frKeys = collectKeys(fr).sort();
  const missingInFr = enKeys.filter((k) => !frKeys.includes(k));
  const missingInEn = frKeys.filter((k) => !enKeys.includes(k));
  assert.deepEqual(missingInFr, [], `Clés manquantes dans fr.js : ${missingInFr.join(", ")}`);
  assert.deepEqual(missingInEn, [], `Clés manquantes dans en.js : ${missingInEn.join(", ")}`);
});
