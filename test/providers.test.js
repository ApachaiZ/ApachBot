"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {normalize, sendPowerRaw, GET_TIMEOUT_MS, POWER_TIMEOUT_MS} = require("../lib/providers/yorkhost");

test("yorkhost.timeouts: lectures et power ont des délais distincts", () => {
  assert.equal(GET_TIMEOUT_MS, 30_000);
  assert.ok(POWER_TIMEOUT_MS > GET_TIMEOUT_MS, "le POST power tolère un arrêt complet du jeu");
});

test("yorkhost.sendPowerRaw: timeout élargi passé au POST uniquement", async () => {
  let captured = null;
  const client = {post: async (url, body, opts) => { captured = {url, body, opts}; }};
  await sendPowerRaw(client, "srv-1", "stop");
  assert.equal(captured.url, "/game-servers/srv-1/power");
  assert.deepEqual(captured.body, {action: "stop"});
  assert.equal(captured.opts.timeout, POWER_TIMEOUT_MS);
});

test("yorkhost.normalize: état online → running", () => {
  const s = normalize({state: "online"});
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "online");
});

test("yorkhost.normalize: état offline → stopped", () => {
  assert.equal(normalize({state: "offline"}).state, "stopped");
});

test("yorkhost.normalize: état running conservé", () => {
  assert.equal(normalize({state: "running"}).state, "running");
});

test("yorkhost.normalize: état inconnu conservé en minuscules", () => {
  assert.equal(normalize({state: "RESTARTING"}).state, "restarting");
});

test("yorkhost.normalize: état absent → unknown", () => {
  assert.equal(normalize({}).state, "unknown");
});

test("yorkhost.normalize: champs passés tels quels", () => {
  const s = normalize({
    name: "srv", state: "online", cpuPct: 42, ramMb: 1024, ramMaxMb: 4096,
    diskMb: 8192, diskMaxMb: 20480, uptimeSeconds: 3600, players: 12, node: "node-01",
  });
  assert.equal(s.name, "srv");
  assert.equal(s.cpuPct, 42);
  assert.equal(s.ramMb, 1024);
  assert.equal(s.ramMaxMb, 4096);
  assert.equal(s.diskMb, 8192);
  assert.equal(s.diskMaxMb, 20480);
  assert.equal(s.uptimeSeconds, 3600);
  assert.equal(s.players, 12);
  assert.equal(s.node, "node-01");
});

test("yorkhost.normalize: champs absents → null", () => {
  const s = normalize({state: "online"});
  assert.equal(s.cpuPct, null);
  assert.equal(s.ramMb, null);
  assert.equal(s.players, null);
  assert.equal(s.address, null);
  assert.equal(s.node, null);
});

test("yorkhost.normalize: address string ip:port", () => {
  assert.deepEqual(normalize({address: "1.2.3.4:25565"}).address, {ip: "1.2.3.4", port: 25565});
});

test("yorkhost.normalize: address objet {host, port}", () => {
  assert.deepEqual(normalize({address: {host: "1.2.3.4", port: 25565}}).address, {ip: "1.2.3.4", port: 25565});
});

test("yorkhost.normalize: address objet {ip, port}", () => {
  assert.deepEqual(normalize({address: {ip: "1.2.3.4", port: "25565"}}).address, {ip: "1.2.3.4", port: 25565});
});

test("yorkhost.normalize: address sans port → port null", () => {
  assert.deepEqual(normalize({address: "1.2.3.4"}).address, {ip: "1.2.3.4", port: null});
  assert.deepEqual(normalize({address: "1.2.3.4:abc"}).address, {ip: "1.2.3.4", port: null});
});

test("yorkhost.normalize: address null ou vide → null", () => {
  assert.equal(normalize({address: null}).address, null);
  assert.equal(normalize({address: {}}).address, null);
});
