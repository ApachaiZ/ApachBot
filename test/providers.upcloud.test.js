"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {normalize} = require("../lib/providers/upcloud");

test("upcloud.normalize: état started → running", () => {
  const s = normalize({state: "started"});
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "started");
});

test("upcloud.normalize: état stopped → stopped", () => {
  assert.equal(normalize({state: "stopped"}).state, "stopped");
});

test("upcloud.normalize: état maintenance → unknown (documenté)", () => {
  const s = normalize({state: "maintenance"});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "maintenance");
});

test("upcloud.normalize: état error → unknown (documenté)", () => {
  const s = normalize({state: "error"});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "error");
});

test("upcloud.normalize: état non reconnu → unknown", () => {
  const s = normalize({state: "pending"});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "pending");
});

test("upcloud.normalize: état absent → unknown", () => {
  assert.equal(normalize({}).state, "unknown");
});

test("upcloud.normalize: état brut ramené en minuscules, mapping insensible à la casse", () => {
  const s = normalize({state: "STARTED"});
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "started");
});

test("upcloud.normalize: name = title en priorité", () => {
  assert.equal(normalize({title: "srv-upcloud", hostname: "host.example.com"}).name, "srv-upcloud");
});

test("upcloud.normalize: name = hostname si title absent", () => {
  assert.equal(normalize({hostname: "host.example.com"}).name, "host.example.com");
});

test("upcloud.normalize: name null si ni title ni hostname", () => {
  assert.equal(normalize({state: "started"}).name, null);
});

test("upcloud.normalize: métriques et compteurs non fournis par l'API → null", () => {
  const s = normalize({state: "started"});
  assert.equal(s.cpuPct, null);
  assert.equal(s.ramMb, null);
  assert.equal(s.ramMaxMb, null);
  assert.equal(s.diskMb, null);
  assert.equal(s.diskMaxMb, null);
  assert.equal(s.uptimeSeconds, null);
  assert.equal(s.players, null);
});

test("upcloud.normalize: première IP publique → {ip, port: null}", () => {
  const s = normalize({
    state: "started",
    ip_addresses: {
      ip_address: [
        {access: "utility", address: "10.0.0.1", family: "IPv4"},
        {access: "public", address: "94.237.0.207", family: "IPv4"},
        {access: "public", address: "2a04::1", family: "IPv6"},
      ],
    },
  });
  assert.deepEqual(s.address, {ip: "94.237.0.207", port: null});
});

test("upcloud.normalize: ip_addresses en tableau direct (réponses start/stop)", () => {
  const s = normalize({
    state: "started",
    ip_addresses: [
      {access: "utility", address: "10.0.0.1"},
      {access: "public", address: "1.2.3.4"},
    ],
  });
  assert.deepEqual(s.address, {ip: "1.2.3.4", port: null});
});

test("upcloud.normalize: pas d'IP publique → address null", () => {
  const s = normalize({
    state: "stopped",
    ip_addresses: {ip_address: [{access: "utility", address: "10.0.0.1", family: "IPv4"}]},
  });
  assert.equal(s.address, null);
});

test("upcloud.normalize: ip_addresses absente ou vide → address null", () => {
  assert.equal(normalize({state: "started"}).address, null);
  assert.equal(normalize({state: "started", ip_addresses: {ip_address: []}}).address, null);
});

test("upcloud.normalize: node = zone", () => {
  assert.equal(normalize({state: "started", zone: "fi-hel1"}).node, "fi-hel1");
  assert.equal(normalize({state: "started"}).node, null);
});

test("upcloud.normalize: réponse enveloppée {server: {...}} (forme réelle de GET /1.3/server/{uuid})", () => {
  const s = normalize({
    server: {
      hostname: "server1.example.com",
      title: "server1.example.com",
      state: "started",
      zone: "fi-hel1",
      ip_addresses: {
        ip_address: [
          {access: "utility", address: "10.0.0.0", family: "IPv4"},
          {access: "public", address: "94.237.0.207", family: "IPv4"},
        ],
      },
    },
  });
  assert.equal(s.state, "running");
  assert.equal(s.name, "server1.example.com");
  assert.equal(s.node, "fi-hel1");
  assert.deepEqual(s.address, {ip: "94.237.0.207", port: null});
});
