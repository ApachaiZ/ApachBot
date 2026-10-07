"use strict";
// Tests unitaires du provider Vultr : normalize() uniquement.
// Aucun réseau, aucune variable d'environnement, aucune clé API requise.
const test = require("node:test");
const assert = require("node:assert/strict");
const {normalize} = require("../lib/providers/vultr");

test("vultr.normalize: état active → running", () => {
  const s = normalize({status: "active"});
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "active");
});

test("vultr.normalize: état stopped → stopped", () => {
  assert.equal(normalize({status: "stopped"}).state, "stopped");
});

// "pending" = instance en cours de provisionnement/démarrage (doc Vultr v2),
// assimilé à "starting" comme documenté dans lib/providers/vultr.js.
test("vultr.normalize: état pending → starting (documenté)", () => {
  const s = normalize({status: "pending"});
  assert.equal(s.state, "starting");
  assert.equal(s.raw_state, "pending");
});

test("vultr.normalize: état inconnu (ex. suspended) → unknown", () => {
  assert.equal(normalize({status: "suspended"}).state, "unknown");
});

test("vultr.normalize: état en majuscules ramené en minuscules", () => {
  const s = normalize({status: "ACTIVE"});
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "active");
});

test("vultr.normalize: état absent → unknown", () => {
  assert.equal(normalize({}).state, "unknown");
});

test("vultr.normalize: label prioritaire sur hostname, sinon null", () => {
  assert.equal(normalize({label: "web-1", hostname: "h"}).name, "web-1");
  assert.equal(normalize({hostname: "h"}).name, "h");
  assert.equal(normalize({}).name, null);
});

test("vultr.normalize: ram en Mo → ramMaxMb, usage non exposé → ramMb null", () => {
  const s = normalize({ram: 2048});
  assert.equal(s.ramMaxMb, 2048);
  assert.equal(s.ramMb, null);
});

test("vultr.normalize: disk en Go converti en Mo → diskMaxMb, diskMb null", () => {
  const s = normalize({disk: 55});
  assert.equal(s.diskMaxMb, 55 * 1024);
  assert.equal(s.diskMb, null);
});

test("vultr.normalize: ram/disk absents ou non numériques → null", () => {
  const s = normalize({});
  assert.equal(s.ramMaxMb, null);
  assert.equal(s.diskMaxMb, null);
  assert.equal(normalize({ram: "abc"}).ramMaxMb, null);
  assert.equal(normalize({disk: NaN}).diskMaxMb, null);
});

test("vultr.normalize: main_ip → {ip, port: null}, absent → null", () => {
  assert.deepEqual(normalize({main_ip: "192.0.2.123"}).address, {ip: "192.0.2.123", port: null});
  assert.equal(normalize({}).address, null);
});

test("vultr.normalize: node = region, absent → null", () => {
  assert.equal(normalize({region: "ewr"}).node, "ewr");
  assert.equal(normalize({}).node, null);
});

test("vultr.normalize: métriques d'usage non exposées → null", () => {
  const s = normalize({status: "active"});
  assert.equal(s.cpuPct, null);
  assert.equal(s.uptimeSeconds, null);
  assert.equal(s.players, null);
});

test("vultr.normalize: enveloppe {instance: {...}} dépliée", () => {
  const s = normalize({
    instance: {
      status: "active", label: "web-1", main_ip: "192.0.2.123",
      region: "ams", ram: 1024, disk: 25, vcpu_count: 1,
    },
  });
  assert.equal(s.state, "running");
  assert.equal(s.name, "web-1");
  assert.deepEqual(s.address, {ip: "192.0.2.123", port: null});
  assert.equal(s.node, "ams");
  assert.equal(s.ramMaxMb, 1024);
  assert.equal(s.diskMaxMb, 25 * 1024);
});
