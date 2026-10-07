"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {normalize, sign} = require("../lib/providers/ovh");

// Tests unitaires du provider OVHcloud — normalize() et sign() uniquement.
// Aucun réseau, aucun accès à process.env (createClient n'est pas testé ici).

test("ovh.normalize: état running → running", () => {
  const s = normalize({state: "running"});
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "running");
});

test("ovh.normalize: état stopped → stopped", () => {
  const s = normalize({state: "stopped"});
  assert.equal(s.state, "stopped");
  assert.equal(s.raw_state, "stopped");
});

test("ovh.normalize: état rebooting → stopping (choix documenté)", () => {
  const s = normalize({state: "rebooting"});
  assert.equal(s.state, "stopping");
  assert.equal(s.raw_state, "rebooting");
});

test("ovh.normalize: état rescued → unknown (choix documenté)", () => {
  const s = normalize({state: "rescued"});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "rescued");
});

test("ovh.normalize: autres états OVH → unknown", () => {
  for (const st of ["installed", "suspended", "updating", "reinstalling", "migrating"]) {
    assert.equal(normalize({state: st}).state, "unknown", `state ${st}`);
    assert.equal(normalize({state: st}).raw_state, st);
  }
});

test("ovh.normalize: état en majuscules → ramené en minuscules", () => {
  const s = normalize({state: "RUNNING"});
  assert.equal(s.state, "running");
  assert.equal(s.raw_state, "running");
});

test("ovh.normalize: état absent → unknown", () => {
  const s = normalize({});
  assert.equal(s.state, "unknown");
  assert.equal(s.raw_state, "unknown");
});

test("ovh.normalize: name = displayName ?? model ?? null", () => {
  assert.equal(
    normalize({state: "running", displayName: "mon-vps", model: "vps-essential-1-2-40"}).name,
    "mon-vps"
  );
  assert.equal(normalize({state: "running", model: "vps-essential-1-2-40"}).name, "vps-essential-1-2-40");
  assert.equal(normalize({state: "running"}).name, null);
});

test("ovh.normalize: métriques non fournies par l'API → null", () => {
  const s = normalize({state: "running"});
  assert.equal(s.cpuPct, null);
  assert.equal(s.ramMb, null);
  assert.equal(s.ramMaxMb, null);
  assert.equal(s.diskMb, null);
  assert.equal(s.diskMaxMb, null);
  assert.equal(s.uptimeSeconds, null);
  assert.equal(s.players, null);
});

test("ovh.normalize: address → null (l'IP vient de GET /vps/{serviceName}/ips)", () => {
  assert.equal(normalize({state: "running", ip: "1.2.3.4"}).address, null);
});

test("ovh.normalize: node = zone ?? null", () => {
  assert.equal(normalize({state: "running", zone: "fr-1"}).node, "fr-1");
  assert.equal(normalize({state: "running"}).node, null);
});

// Signature OVHcloud : "$1$" + SHA1_HEX(AS+"+"+CK+"+"+METHOD+"+"+QUERY+"+"+BODY+"+"+TSTAMP)
// Vecteur de la documentation officielle :
// https://docs.ovhcloud.com/en/guides/manage-and-operate/api/first-steps.md

test("ovh.sign: vecteur officiel de la documentation", () => {
  assert.equal(
    sign({
      method: "PUT",
      url: "/path/to/api",
      body: "TEST DATA",
      applicationSecret: "appSecret",
      consumerKey: "consKey",
      timestamp: 123456789,
    }),
    "$1$8336ecc5d03640b976e0b3ba005234a3046ab695"
  );
});

test("ovh.sign: préfixe $1$ + 40 caractères hexadécimaux", () => {
  const s = sign({
    method: "GET",
    url: "/vps/vps-abc.ovh.net",
    applicationSecret: "AS",
    consumerKey: "CK",
    timestamp: 1700000000,
  });
  assert.match(s, /^\$1\$[0-9a-f]{40}$/);
});

test("ovh.sign: corps absent → chaîne vide dans la chaîne signée", () => {
  // POST sans corps : la chaîne signée contient une chaîne vide entre QUERY et TSTAMP.
  const s = sign({
    method: "POST",
    url: "/vps/vps-abc.ovh.net/start",
    applicationSecret: "AS",
    consumerKey: "CK",
    timestamp: 1700000000,
  });
  const crypto = require("node:crypto");
  const attendu =
    "$1$" +
    crypto.createHash("sha1").update("AS+CK+POST+/vps/vps-abc.ovh.net/start++1700000000", "utf8").digest("hex");
  assert.equal(s, attendu);
});

test("ovh.sign: la méthode est normalisée en majuscules", () => {
  const a = sign({
    method: "post",
    url: "/vps/x/stop",
    applicationSecret: "AS",
    consumerKey: "CK",
    timestamp: 1700000000,
  });
  const b = sign({
    method: "POST",
    url: "/vps/x/stop",
    applicationSecret: "AS",
    consumerKey: "CK",
    timestamp: 1700000000,
  });
  assert.equal(a, b);
});
