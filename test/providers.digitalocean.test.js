"use strict";

// Tests du provider DigitalOcean — uniquement normalize(), sans réseau ni env.
const test = require("node:test");
const assert = require("node:assert/strict");
const {normalize} = require("../lib/providers/digitalocean");

test("digitalocean.normalize: statut active → running", () => {
  const s = normalize({status: "active"});
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "active");
});

test("digitalocean.normalize: statut off → stopped", () => {
  const s = normalize({status: "off"});
  assert.equal(s.state, "stopped");
  assert.equal(s.raw_state, "off");
});

test("digitalocean.normalize: statut new → starting", () => {
  const s = normalize({status: "new"});
  assert.equal(s.state, "starting");
  assert.equal(s.raw_state, "new");
});

test("digitalocean.normalize: statut non mappé (archive) → unknown", () => {
  const s = normalize({status: "archive"});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "archive");
});

test("digitalocean.normalize: statut absent → unknown", () => {
  const s = normalize({});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "unknown");
});

test("digitalocean.normalize: raw_state toujours en minuscules", () => {
  assert.equal(normalize({status: "ACTIVE"}).raw_state, "active");
});

test("digitalocean.normalize: name transmis", () => {
  assert.equal(normalize({name: "droplet-01", status: "active"}).name, "droplet-01");
});

test("digitalocean.normalize: name absent → null", () => {
  assert.equal(normalize({status: "active"}).name, null);
});

test("digitalocean.normalize: métriques toujours null (non fournies par l'API)", () => {
  // Même si l'API renvoie memory/disk, le contrat du provider rend ces
  // métriques d'utilisation à null : DigitalOcean ne les expose pas.
  const s = normalize({
    status: "active", memory: 1024, disk: 25, uptime: 3600, players: 3,
  });
  assert.equal(s.cpuPct, null);
  assert.equal(s.ramMb, null);
  assert.equal(s.ramMaxMb, null);
  assert.equal(s.diskMb, null);
  assert.equal(s.diskMaxMb, null);
  assert.equal(s.uptimeSeconds, null);
  assert.equal(s.uptime, null);
  assert.equal(s.players, null);
});

test("digitalocean.normalize: address = première IP publique v4, port null", () => {
  const s = normalize({
    status: "active",
    networks: {
      v4: [
        {ip_address: "10.10.0.5", netmask: "255.255.0.0", gateway: null, type: "private"},
        {ip_address: "104.236.32.182", netmask: "255.255.192.0", gateway: "104.236.0.1", type: "public"},
        {ip_address: "159.89.4.2", netmask: "255.255.255.0", gateway: "159.89.4.1", type: "public"},
      ],
    },
  });
  assert.deepEqual(s.address, {ip: "104.236.32.182", port: null});
});

test("digitalocean.normalize: address uniquement privée → null", () => {
  const s = normalize({
    status: "active",
    networks: {v4: [{ip_address: "10.10.0.5", netmask: "255.255.0.0", gateway: null, type: "private"}]},
  });
  assert.equal(s.address, null);
});

test("digitalocean.normalize: address sans réseaux → null", () => {
  assert.equal(normalize({status: "active"}).address, null);
  assert.equal(normalize({status: "active", networks: {}}).address, null);
  assert.equal(normalize({status: "active", networks: {v4: []}}).address, null);
});

test("digitalocean.normalize: node = slug de région", () => {
  const s = normalize({status: "active", region: {name: "New York 3", slug: "nyc3"}});
  assert.equal(s.node, "nyc3");
});

test("digitalocean.normalize: node absent → null", () => {
  assert.equal(normalize({status: "active"}).node, null);
});

test("digitalocean.normalize: entrée non-objet tolérée", () => {
  const s = normalize(null);
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "unknown");
  assert.equal(s.address, null);
  assert.equal(s.node, null);
});
