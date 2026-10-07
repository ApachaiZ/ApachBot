"use strict";

// Tests de normalisation du provider Hetzner Cloud.
// Aucun réseau, aucun env factice : le module ne doit rien exiger
// au chargement (seulement node:https et axios).

const test = require("node:test");
const assert = require("node:assert/strict");
const {normalize} = require("../lib/providers/hetzner");

test("hetzner.normalize: status running → running", () => {
  const s = normalize({status: "running"});
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "running");
});

test("hetzner.normalize: status off → stopped", () => {
  assert.equal(normalize({status: "off"}).state, "stopped");
});

test("hetzner.normalize: status starting → starting", () => {
  assert.equal(normalize({status: "starting"}).state, "starting");
});

test("hetzner.normalize: status initializing → starting", () => {
  assert.equal(normalize({status: "initializing"}).state, "starting");
});

test("hetzner.normalize: status stopping → stopping", () => {
  assert.equal(normalize({status: "stopping"}).state, "stopping");
});

test("hetzner.normalize: status deleting → stopping", () => {
  assert.equal(normalize({status: "deleting"}).state, "stopping");
});

test("hetzner.normalize: status rebuilding → stopping", () => {
  assert.equal(normalize({status: "rebuilding"}).state, "stopping");
});

test("hetzner.normalize: status inconnu → unknown, raw_state minuscule", () => {
  const s = normalize({status: "WEIRD-STATE"});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "weird-state");
});

test("hetzner.normalize: status absent → unknown", () => {
  assert.equal(normalize({}).state, "unknown");
});

test("hetzner.normalize: enveloppe {server: {...}} dépliée", () => {
  const s = normalize({server: {name: "srv", status: "running"}});
  assert.equal(s.name, "srv");
  assert.equal(s.state, "running");
});

test("hetzner.normalize: champs non fournis par l'API → null", () => {
  const s = normalize({name: "srv", status: "running"});
  assert.equal(s.name, "srv");
  assert.equal(s.cpuPct, null);
  assert.equal(s.ramMb, null);
  assert.equal(s.ramMaxMb, null);
  assert.equal(s.diskMb, null);
  assert.equal(s.diskMaxMb, null);
  assert.equal(s.uptimeSeconds, null);
  assert.equal(s.players, null);
  assert.equal(s.address, null);
  assert.equal(s.node, null);
});

test("hetzner.normalize: address depuis public_net.ipv4.ip", () => {
  const s = normalize({
    status: "running",
    public_net: {ipv4: {ip: "203.0.113.7"}, ipv6: {ip: "2001:db8::1"}},
  });
  assert.deepEqual(s.address, {ip: "203.0.113.7", port: null});
});

test("hetzner.normalize: address absente ou sans ipv4 → null", () => {
  assert.equal(normalize({status: "running", public_net: {ipv6: {ip: "2001:db8::1"}}}).address, null);
  assert.equal(normalize({status: "running", public_net: {ipv4: {}}}).address, null);
});

test("hetzner.normalize: node = datacenter.name", () => {
  const s = normalize({status: "running", datacenter: {name: "fsn1-dc14"}});
  assert.equal(s.node, "fsn1-dc14");
});
