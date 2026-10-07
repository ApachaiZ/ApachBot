"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

// Forcer la langue de test : les assertions ci-dessous vérifient des chaînes
// anglaises littérales. Sans cela, un .apach/.env local en français ferait
// échouer la suite sans qu'aucun code applicatif n'ait changé.
process.env.BOT_LANGUAGE = "en";

if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";

const {errorText} = require("../lib/interaction");

test("errorText: contexte 'power' → suffixe anti-retry", () => {
  const out = errorText(new Error("network"), "power");
  assert.match(out, /No automatic retry of power requests/);
});

test("errorText: contexte 'other' → pas de suffixe", () => {
  const out = errorText(new Error("network"), "other");
  assert.doesNotMatch(out, /No automatic retry/);
});

test("errorText: affiche le status HTTP", () => {
  const err = new Error("err");
  err.response = {status: 401};
  assert.match(errorText(err, "power"), /HTTP 401/);
});

test("errorText: affiche le code renvoyé par l'API", () => {
  const err = new Error("err");
  err.response = {status: 403, data: {code: "FORBIDDEN"}};
  assert.match(errorText(err, "other"), /FORBIDDEN/);
});

test("errorText: message neutre avec le message réel de l'erreur", () => {
  const out = errorText(new Error("boom"), "other");
  assert.match(out, /Request failed\. boom/);
  assert.doesNotMatch(out, /API key/, "on n'accuse plus la clé API à tort");
});

test("errorText: 401 → message dédié clé API", () => {
  const err = new Error("err");
  err.response = {status: 401};
  const out = errorText(err, "other");
  assert.match(out, /Authentication failed/);
  assert.match(out, /API key/);
});

test("errorText: 404 → message dédié ID de service", () => {
  const err = new Error("err");
  err.response = {status: 404};
  const out = errorText(err, "other");
  assert.match(out, /Target not found/);
  assert.match(out, /service ID/);
});

test("errorText: 429 → message dédié rate limit", () => {
  const err = new Error("err");
  err.response = {status: 429};
  assert.match(errorText(err, "other"), /Rate limited/);
});

test("errorText: 5xx sans transmission → rien n'a été envoyé", () => {
  const err = new Error("err");
  err.response = {status: 502};
  assert.match(errorText(err, "other"), /Nothing was sent/);
});

test("errorText: 5xx après transmission → action peut avoir été appliquée", () => {
  const err = new Error("err");
  err.response = {status: 500};
  err._powerSent = true;
  const out = errorText(err, "power");
  assert.match(out, /may have been applied/);
  assert.match(out, /No automatic retry/);
});

test("errorText: timeout sans transmission → rien n'a été envoyé", () => {
  const err = new Error("err");
  err.code = "ECONNABORTED";
  const out = errorText(err, "power");
  assert.match(out, /Nothing was sent/);
  assert.match(out, /No automatic retry/);
});

test("errorText: timeout après transmission → action peut avoir été appliquée", () => {
  const err = new Error("err");
  err.code = "ETIMEDOUT";
  err._powerSent = true;
  const out = errorText(err, "power");
  assert.match(out, /may have been applied/);
  assert.doesNotMatch(out, /API key/);
});

test("errorText: erreur réseau → message connectivité", () => {
  const err = new Error("err");
  err.code = "ECONNREFUSED";
  const out = errorText(err, "other");
  assert.match(out, /network/);
  assert.doesNotMatch(out, /API key/);
});

test("errorText: connexion interrompue → message dédié", () => {
  const err = new Error("err");
  err.code = "ECONNRESET";
  const out = errorText(err, "other");
  assert.match(out, /interrupted/);
  assert.doesNotMatch(out, /API key/);
});

test("errorText: connexion interrompue après transmission → action peut avoir été appliquée", () => {
  const err = new Error("err");
  err.code = "ECONNRESET";
  err._powerSent = true;
  const out = errorText(err, "power");
  assert.match(out, /may have been applied/);
  assert.match(out, /No automatic retry/);
});
