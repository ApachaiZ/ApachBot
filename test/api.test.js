"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

// Env factices — requis car lib/api.js importe lib/config.js, qui valide au require.
if (!process.env.DISCORD_TOKEN) process.env.DISCORD_TOKEN = "test-token";
if (!process.env.DISCORD_CLIENT_ID) process.env.DISCORD_CLIENT_ID = "test-client";
if (!process.env.DISCORD_OWNER_ID) process.env.DISCORD_OWNER_ID = "999";
if (!process.env.DISCORD_GUILD_ID) process.env.DISCORD_GUILD_ID = "888";
if (!process.env.PROVIDER_API_KEY) process.env.PROVIDER_API_KEY = "test-key";
if (!process.env.PROVIDER_SERVICE_ID) process.env.PROVIDER_SERVICE_ID = "test-service";

const api = require("../lib/api");
// Le provider exposé par config.js est le même objet que ce module : patcher
// ses méthodes suffit à contrôler l'API sans réseau.
const yh = require("../lib/providers/yorkhost");

const raw = {name: "srv", state: "online", cpuPct: 10};

test("api.get: normalise la réponse du provider", async () => {
  let calls = 0;
  const orig = yh.fetchRaw;
  yh.fetchRaw = async () => { calls++; return {...raw}; };
  try {
    api.clearCache();
    const s = await api.get("svc-norm", {fresh: true});
    assert.equal(s.state, "running");
    assert.equal(s.name, "srv");
    assert.equal(calls, 1);
  } finally { yh.fetchRaw = orig; api.clearCache(); }
});

test("api.get: cache 5 s — deux appels rapprochés, une seule requête", async () => {
  let calls = 0;
  const orig = yh.fetchRaw;
  yh.fetchRaw = async () => { calls++; return {...raw}; };
  try {
    api.clearCache();
    await api.get("svc-cache");
    await api.get("svc-cache");
    assert.equal(calls, 1);
  } finally { yh.fetchRaw = orig; api.clearCache(); }
});

test("api.get: {fresh: true} contourne le cache", async () => {
  let calls = 0;
  const orig = yh.fetchRaw;
  yh.fetchRaw = async () => { calls++; return {...raw}; };
  try {
    api.clearCache();
    await api.get("svc-fresh");
    await api.get("svc-fresh", {fresh: true});
    assert.equal(calls, 2);
  } finally { yh.fetchRaw = orig; api.clearCache(); }
});

test("api.get: déduplication des requêtes en vol", async () => {
  let calls = 0;
  const orig = yh.fetchRaw;
  yh.fetchRaw = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 20));
    return {...raw};
  };
  try {
    api.clearCache();
    await Promise.all([
      api.get("svc-inflight", {fresh: true}),
      api.get("svc-inflight", {fresh: true}),
      api.get("svc-inflight", {fresh: true}),
    ]);
    assert.equal(calls, 1);
  } finally { yh.fetchRaw = orig; api.clearCache(); }
});

test("api.get: clearCache(serviceId) n'invalide que ce service", async () => {
  let calls = 0;
  const orig = yh.fetchRaw;
  yh.fetchRaw = async () => { calls++; return {...raw}; };
  try {
    api.clearCache();
    await api.get("svc-a");
    await api.get("svc-b");
    assert.equal(calls, 2);
    await api.get("svc-a");
    assert.equal(calls, 2);
    api.clearCache("svc-a");
    await api.get("svc-a");
    assert.equal(calls, 3);
    await api.get("svc-b");
    assert.equal(calls, 3);
  } finally { yh.fetchRaw = orig; api.clearCache(); }
});

test("api.get: propage l'erreur réseau", async () => {
  const orig = yh.fetchRaw;
  yh.fetchRaw = async () => { throw new Error("boom"); };
  try {
    api.clearCache();
    await assert.rejects(api.get("svc-err", {fresh: true}), /boom/);
  } finally { yh.fetchRaw = orig; api.clearCache(); }
});

test("api.sendPower: délègue au provider", async () => {
  let last = null;
  const orig = yh.sendPowerRaw;
  yh.sendPowerRaw = async (client, id, action) => { last = {id, action}; };
  try {
    await api.sendPower("svc-p", "stop");
    assert.deepEqual(last, {id: "svc-p", action: "stop"});
  } finally { yh.sendPowerRaw = orig; }
});
