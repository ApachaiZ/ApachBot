"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {bar, fmt, state, online, offline, dashboard} = require("../lib/embeds");

test("bar: format des pourcentages", () => {
  assert.equal(bar(5, 10), "▰▰▰▰▰▱▱▱▱▱ 50.0%");
  assert.equal(bar(0, 100), "▱▱▱▱▱▱▱▱▱▱ 0.0%");
  assert.equal(bar(100, 100), "▰▰▰▰▰▰▰▰▰▰ 100.0%");
});

test("bar: clamp des valeurs hors bornes", () => {
  assert.equal(bar(200, 100), "▰▰▰▰▰▰▰▰▰▰ 100.0%");
  assert.equal(bar(-50, 100), "▱▱▱▱▱▱▱▱▱▱ 0.0%");
});

test("bar: Not reported sur données manquantes", () => {
  assert.equal(bar(null, 100), "Not reported");
  assert.equal(bar(5, 0), "Not reported");
  assert.equal(bar(5, null), "Not reported");
  assert.equal(bar(undefined, undefined), "Not reported");
});

test("fmt: formate les nombres", () => {
  assert.equal(fmt(1000), "1,000");
  assert.equal(fmt(0), "0");
});

test("fmt: N/A sur entrée invalide", () => {
  assert.equal(fmt(null), "N/A");
  assert.equal(fmt(undefined), "N/A");
  assert.equal(fmt("abc"), "N/A");
});

test("state: normalise en minuscules", () => {
  assert.equal(state({state: "Running"}), "running");
  assert.equal(state({}), "unknown");
});

test("online/offline: helpers d'état", () => {
  assert.equal(online({state: "running"}), true);
  assert.equal(online({state: "online"}), true);
  assert.equal(online({state: "offline"}), false);
  assert.equal(offline({state: "stopped"}), true);
  assert.equal(offline({state: "offline"}), true);
  assert.equal(offline({state: "running"}), false);
});

test("dashboard: construit sans erreur avec données complètes", () => {
  const e = dashboard({
    name: "srv", state: "running", cpuPct: 10, players: 2, uptimeSeconds: 3600,
    ramMb: 100, ramMaxMb: 200, diskMb: 1, diskMaxMb: 2,
    address: {ip: "1.2.3.4", port: 25565}, node: "n1"
  });
  assert.ok(e);
});

test("dashboard: construit sans erreur avec données vides", () => {
  const e = dashboard({});
  assert.ok(e);
});
