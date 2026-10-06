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

test("errorText: message neutre sans status ni code", () => {
  const out = errorText(new Error("boom"), "other");
  assert.match(out, /Request failed\. Check your API key/);
});
