"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {normalize} = require("../lib/providers/scaleway");

test("scaleway.normalize: état running conservé", () => {
  assert.equal(normalize({state: "running"}).state, "running");
});

test("scaleway.normalize: état stopped conservé", () => {
  assert.equal(normalize({state: "stopped"}).state, "stopped");
});

test("scaleway.normalize: état starting conservé", () => {
  assert.equal(normalize({state: "starting"}).state, "starting");
});

test("scaleway.normalize: état stopping conservé", () => {
  assert.equal(normalize({state: "stopping"}).state, "stopping");
});

test("scaleway.normalize: état locked → unknown", () => {
  const s = normalize({state: "locked"});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "locked");
});

test("scaleway.normalize: état inconnu → unknown", () => {
  assert.equal(normalize({state: "expiring"}).state, "unknown");
});

test("scaleway.normalize: état absent → unknown", () => {
  const s = normalize({});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "unknown");
});

test("scaleway.normalize: raw_state en minuscules", () => {
  assert.equal(normalize({state: "RUNNING"}).raw_state, "running");
});

test("scaleway.normalize: name conservé", () => {
  assert.equal(normalize({name: "mon-serveur"}).name, "mon-serveur");
});

test("scaleway.normalize: name absent → null", () => {
  assert.equal(normalize({}).name, null);
});

test("scaleway.normalize: champs non fournis par l'API → null", () => {
  const s = normalize({state: "running"});
  assert.equal(s.cpuPct, null);
  assert.equal(s.ramMb, null);
  assert.equal(s.ramMaxMb, null);
  assert.equal(s.diskMb, null);
  assert.equal(s.diskMaxMb, null);
  assert.equal(s.uptimeSeconds, null);
  assert.equal(s.players, null);
});

test("scaleway.normalize: public_ip → address {ip, port: null}", () => {
  assert.deepEqual(
    normalize({public_ip: {address: "51.15.1.2"}}).address,
    {ip: "51.15.1.2", port: null}
  );
});

test("scaleway.normalize: address absente → null", () => {
  assert.equal(normalize({}).address, null);
  assert.equal(normalize({public_ip: null}).address, null);
  assert.equal(normalize({public_ip: {}}).address, null);
});

test("scaleway.normalize: node = zone", () => {
  assert.equal(normalize({zone: "fr-par-1"}).node, "fr-par-1");
});

test("scaleway.normalize: node absent → null", () => {
  assert.equal(normalize({}).node, null);
});
