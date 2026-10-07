"use strict";
// Tests de `normalize` du provider Nitrado — uniquement, sans réseau ni variables d'env.
const test = require("node:test");
const assert = require("node:assert/strict");
const {normalize} = require("../lib/providers/nitrado");

// Corps de GET /services/{id}/gameservers (doc officielle apiDoc) :
// {status:"success", data:{gameserver:{..., query:{server_name, connect_ip, player_current, ...}}}}
function detail(status, query = {}, extra = {}) {
  return {
    status: "success",
    data: {gameserver: {id: 1, service_id: 1, status, query, ...extra}},
  };
}

test("nitrado.normalize: started → running", () => {
  const s = normalize(detail("started"));
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "started");
});

test("nitrado.normalize: stopped → stopped", () => {
  assert.equal(normalize(detail("stopped")).state, "stopped");
});

test("nitrado.normalize: suspended → stopped (service suspendu)", () => {
  const s = normalize(detail("suspended"));
  assert.equal(s.state, "stopped");
  assert.equal(s.raw_state, "suspended");
});

test("nitrado.normalize: starting → starting (accepté par prudence)", () => {
  assert.equal(normalize(detail("starting")).state, "starting");
});

test("nitrado.normalize: stopping → stopping", () => {
  assert.equal(normalize(detail("stopping")).state, "stopping");
});

test("nitrado.normalize: statut non mappé (restarting, guardian_locked) → unknown, raw_state conservé", () => {
  const s = normalize(detail("RESTARTING"));
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "restarting");
  const g = normalize(detail("guardian_locked"));
  assert.equal(g.state, "unknown");
  assert.equal(g.raw_state, "guardian_locked");
});

test("nitrado.normalize: statut absent → unknown", () => {
  const s = normalize({data: {gameserver: {}}});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "unknown");
});

test("nitrado.normalize: name et players depuis query", () => {
  const s = normalize(detail("started", {server_name: "Mon Serveur", player_current: "8"}));
  assert.equal(s.name, "Mon Serveur");
  assert.equal(s.players, 8);
});

test("nitrado.normalize: players absent → null", () => {
  assert.equal(normalize(detail("started", {server_name: "srv"})).players, null);
});

test("nitrado.normalize: address depuis query.connect_ip (format ip:port)", () => {
  const s = normalize(detail("started", {connect_ip: "1.2.3.4:25565"}));
  assert.deepEqual(s.address, {ip: "1.2.3.4", port: 25565});
});

test("nitrado.normalize: address en repli sur ip/port racines du gameserver", () => {
  const s = normalize(detail("started", {}, {ip: "5.6.7.8", port: "19132"}));
  assert.deepEqual(s.address, {ip: "5.6.7.8", port: 19132});
});

test("nitrado.normalize: address via query.server_ip/server_port (anciennes versions d'API)", () => {
  const s = normalize(detail("started", {server_ip: "9.9.9.9", server_port: "25565"}));
  assert.deepEqual(s.address, {ip: "9.9.9.9", port: 25565});
});

test("nitrado.normalize: connect_ip sans port → port null", () => {
  assert.deepEqual(normalize(detail("started", {connect_ip: "1.2.3.4"})).address, {ip: "1.2.3.4", port: null});
});

test("nitrado.normalize: address absente → null", () => {
  assert.equal(normalize(detail("started")).address, null);
});

test("nitrado.normalize: node = location_id, absent → null", () => {
  assert.equal(normalize(detail("started", {}, {location_id: 42})).node, 42);
  assert.equal(normalize(detail("started")).node, null);
});

test("nitrado.normalize: stats [valeur, timestamp] → dernier point de chaque série", () => {
  const raw = detail("started");
  raw.data.stats = {
    cpuUsage: [[3.5, 1000], [12.25, 2000]],
    memoryUsage: [[128, 1000], [512, 2000]],
    currentPlayers: [[0, 1000], ["8", 2000]],
  };
  const s = normalize(raw);
  assert.equal(s.cpuPct, 12.25);
  assert.equal(s.ramMb, 512);
  assert.equal(s.players, 8);
});

test("nitrado.normalize: stats absentes → cpuPct/ramMb null (players via query conservé)", () => {
  const s = normalize(detail("started", {player_current: 3}));
  assert.equal(s.cpuPct, null);
  assert.equal(s.ramMb, null);
  assert.equal(s.players, 3);
});

test("nitrado.normalize: champs non exposés par l'API → null", () => {
  const s = normalize(detail("started", {server_name: "srv"}));
  assert.equal(s.ramMaxMb, null);
  assert.equal(s.diskMb, null);
  assert.equal(s.diskMaxMb, null);
  assert.equal(s.uptimeSeconds, null);
});

test("nitrado.normalize: entrée vide/null ne lève pas", () => {
  const s = normalize(null);
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "unknown");
  assert.equal(s.address, null);
});
